import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, randomBytes } from 'crypto';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../tenants/encryption.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { AuthenticatedUser, TokenPayload } from './types';

export interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly encryption: EncryptionService,
  ) {}

  private static readonly MAX_FAILED_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000;

  async login(email: string | undefined, password: string | undefined, meta: RequestMeta) {
    if (!email || !password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        memberships: {
          include: {
            tenant: {
              include: {
                enabledServices: true,
              },
            },
          },
        },
      },
    });

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new UnauthorizedException(`Account locked. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`);
    }

    if (!user || !(await this.passwords.verify(password, user.passwordHash))) {
      if (user) {
        const attempts = user.failedLoginAttempts + 1;
        const lockout = attempts >= AuthService.MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + AuthService.LOCKOUT_DURATION_MS)
          : null;
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: attempts, lockedUntil: lockout },
        });
        if (lockout) {
          await this.prisma.auditLog.create({ data: { actorUserId: user.id, event: 'auth.account.locked', metadata: { attempts, ipAddress: meta.ipAddress } } });
          throw new UnauthorizedException('Too many failed attempts. Account locked for 15 minutes.');
        }
      }
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.failedLoginAttempts > 0) {
      await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    }

    if (user.twoFactorEnabled) {
      const twoFactorToken = randomBytes(32).toString('hex');
      await this.prisma.session.create({
        data: { userId: user.id, expiresAt: new Date(Date.now() + 1000 * 60 * 5) },
      });
      return { requiresTwoFactor: true, twoFactorToken: this.hash(twoFactorToken), userId: user.id };
    }

    return this.issueTokens(user, meta);
  }

  async verifyTwoFactor(userId: string, code: string | undefined, meta: RequestMeta) {
    if (!code || code.trim().length < 6) throw new BadRequestException('2FA code is required');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { include: { tenant: { include: { enabledServices: true } } } } },
    });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecretCipher) {
      throw new UnauthorizedException('Invalid 2FA request');
    }
    const secret = this.encryption.decrypt(user.twoFactorSecretCipher);
    if (!this.verifyTotp(secret, code.trim())) {
      if (!user.backupCodes) throw new UnauthorizedException('Invalid 2FA code');
      const codes: string[] = JSON.parse(user.backupCodes);
      const codeHash = this.hash(code.trim());
      const idx = codes.indexOf(codeHash);
      if (idx === -1) throw new UnauthorizedException('Invalid 2FA code');
      codes.splice(idx, 1);
      await this.prisma.user.update({ where: { id: userId }, data: { backupCodes: JSON.stringify(codes) } });
    }
    return this.issueTokens(user, meta);
  }

  private async issueTokens(
    user: { id: string; email: string; role: UserRole; tenantId?: string | null; tenantName?: string | null; name: string; initials: string; twoFactorEnabled?: boolean; memberships: Array<{ tenant: { id: string; companyName: string; enabledServices: { key: string }[] } }> },
    meta: RequestMeta,
  ) {
    const tenant = user.memberships[0]?.tenant;
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId ?? tenant?.id,
    };

    const accessToken = this.tokens.signAccessToken(payload);
    const refreshToken = this.tokens.createOpaqueToken();
    const refreshTokenHash = this.tokens.hashOpaqueToken(refreshToken);
    const expiresAt = this.tokens.getRefreshExpiry();

    await this.prisma.$transaction([
      this.prisma.session.create({ data: { userId: user.id, expiresAt } }),
      this.prisma.refreshToken.create({ data: { userId: user.id, tokenHash: refreshTokenHash, expiresAt } }),
    ]);

    return {
      user: this.toPublicUser(user, tenant),
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.tokens.accessTokenTtlSeconds,
      meta,
    };
  }

  async register(name: string | undefined, email: string | undefined, password: string | undefined, meta: RequestMeta) {
    if (!name || !name.trim()) throw new BadRequestException('name is required');
    if (!email || !email.trim()) throw new BadRequestException('email is required');
    if (!password || password.length < 8) throw new BadRequestException('password must be at least 8 characters');
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) throw new BadRequestException('Email is already registered');
    const initials = name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase()).join('').slice(0, 2);
    const verificationToken = randomBytes(32).toString('hex');
    const user = await this.prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash: await this.passwords.hash(password),
        role: UserRole.client,
        initials: initials || 'U',
        emailVerified: false,
        emailVerificationToken: this.hash(verificationToken),
      },
    });
    await this.prisma.auditLog.create({ data: { actorUserId: user.id, event: 'auth.user.registered', metadata: { email: normalizedEmail } } });
    await this.sendVerificationEmail(normalizedEmail, name.trim(), verificationToken);
    const userWithMemberships = { ...user, memberships: [] as Array<{ tenant: { id: string; companyName: string; enabledServices: { key: string }[] } }> };
    return this.issueTokens(userWithMemberships, meta);
  }

  async verifyEmail(token: string | undefined) {
    if (!token) throw new BadRequestException('Verification token is required');
    const tokenHash = this.hash(token);
    const user = await this.prisma.user.findFirst({ where: { emailVerificationToken: tokenHash } });
    if (!user) throw new BadRequestException('Invalid or expired verification token');
    if (user.emailVerified) return { success: true, alreadyVerified: true };
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerificationToken: null },
    });
    await this.prisma.auditLog.create({ data: { actorUserId: user.id, event: 'auth.email.verified', metadata: {} } });
    return { success: true };
  }

  async resendVerification(user: AuthenticatedUser) {
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) throw new NotFoundException('User not found');
    if (dbUser.emailVerified) return { success: true, alreadyVerified: true };
    const verificationToken = randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken: this.hash(verificationToken) },
    });
    await this.sendVerificationEmail(dbUser.email, dbUser.name, verificationToken);
    return { success: true };
  }

  private async sendVerificationEmail(to: string, name: string, token: string) {
    const appUrl = process.env.APP_PUBLIC_URL ?? 'http://localhost:5173';
    const verifyUrl = `${appUrl}/verify-email?token=${token}`;
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SYSTEM_FROM_EMAIL ?? 'noreply@nexushq.io';
    const fromName = process.env.SYSTEM_FROM_NAME ?? 'NexusHQ';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Verify your email</h2>
        <p>Hi ${name},</p>
        <p>Welcome to NexusHQ! Please verify your email address to get full access:</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${verifyUrl}" style="background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">Verify Email</a>
        </p>
        <p style="font-size: 13px; color: #6b7280;">If you didn't create this account, you can safely ignore this email.</p>
      </div>`;

    if (!apiKey) {
      console.warn(`[EMAIL-SIM] Verification email to ${to} — link: ${verifyUrl}`);
      return;
    }
    try {
      await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: fromEmail, name: fromName },
          subject: 'Verify your NexusHQ email',
          content: [{ type: 'text/html', value: html }],
        }),
      });
    } catch (error) {
      console.error('Verification email failed:', error instanceof Error ? error.message : error);
    }
  }

  async refresh(refreshToken: string | undefined, meta: RequestMeta) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokenHash = this.tokens.hashOpaqueToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            memberships: {
              include: {
                tenant: {
                  include: {
                    enabledServices: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tenant = stored.user.memberships[0]?.tenant;
    const payload: TokenPayload = {
      sub: stored.user.id,
      email: stored.user.email,
      role: stored.user.role,
      tenantId: stored.user.tenantId ?? tenant?.id,
    };

    const nextRefreshToken = this.tokens.createOpaqueToken();
    const nextRefreshTokenHash = this.tokens.hashOpaqueToken(nextRefreshToken);
    const expiresAt = this.tokens.getRefreshExpiry();

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: stored.userId,
          tokenHash: nextRefreshTokenHash,
          expiresAt,
        },
      }),
    ]);

    return {
      user: this.toPublicUser(stored.user, tenant),
      accessToken: this.tokens.signAccessToken(payload),
      refreshToken: nextRefreshToken,
      tokenType: 'Bearer',
      expiresIn: this.tokens.accessTokenTtlSeconds,
      meta,
    };
  }

  async logout(refreshToken?: string, authorization?: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: {
          tokenHash: this.tokens.hashOpaqueToken(refreshToken),
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    const bearer = this.tokens.extractBearerToken(authorization);
    if (bearer) {
      const decoded = this.tokens.verifyAccessToken(bearer);
      await this.prisma.session.updateMany({
        where: {
          userId: decoded.sub,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    return { success: true };
  }

  async me(user: AuthenticatedUser) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        memberships: {
          include: {
            tenant: {
              include: {
                enabledServices: true,
              },
            },
          },
        },
      },
    });

    if (!dbUser) {
      throw new UnauthorizedException('User no longer exists');
    }

    return this.toPublicUser(dbUser, dbUser.memberships[0]?.tenant);
  }

  async changePassword(user: AuthenticatedUser, currentPassword: string | undefined, nextPassword: string | undefined) {
    if (!currentPassword || !nextPassword) throw new BadRequestException('currentPassword and nextPassword are required');
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser || !(await this.passwords.verify(currentPassword, dbUser.passwordHash))) {
      throw new UnauthorizedException('Current password is invalid');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await this.passwords.hash(nextPassword) } }),
      this.prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.auditLog.create({ data: { actorUserId: user.id, tenantId: user.tenantId, event: 'auth.password.changed', metadata: {} } }),
    ]);
    return { success: true };
  }

  sessions(user: AuthenticatedUser) {
    return this.prisma.session.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async revokeSession(user: AuthenticatedUser, sessionId: string) {
    const result = await this.prisma.session.updateMany({
      where: { id: sessionId, userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Session not found');
    return { success: true };
  }

  async requestPasswordReset(email: string | undefined) {
    if (!email) throw new BadRequestException('email is required');
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return { success: true };
    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(token),
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
      },
    });

    const appUrl = process.env.APP_PUBLIC_URL ?? 'http://localhost:5173';
    const resetUrl = `${appUrl}/password-reset?token=${token}`;
    await this.sendPasswordResetEmail(user.email, user.name, resetUrl);

    return { success: true };
  }

  private async sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SYSTEM_FROM_EMAIL ?? 'noreply@nexushq.io';
    const fromName = process.env.SYSTEM_FROM_NAME ?? 'NexusHQ';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>Hi ${name},</p>
        <p>We received a request to reset your password. Click the button below to set a new password:</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}" style="background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">Reset Password</a>
        </p>
        <p style="font-size: 13px; color: #6b7280;">This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.</p>
      </div>`;

    if (!apiKey) {
      console.warn(`[EMAIL-SIM] Password reset email to ${to} — link: ${resetUrl}`);
      return;
    }
    try {
      await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: fromEmail, name: fromName },
          subject: 'Reset your NexusHQ password',
          content: [{ type: 'text/html', value: html }],
        }),
      });
    } catch (error) {
      console.error('Password reset email failed:', error instanceof Error ? error.message : error);
    }
  }

  async confirmPasswordReset(token: string | undefined, nextPassword: string | undefined) {
    if (!token || !nextPassword) throw new BadRequestException('token and nextPassword are required');
    const reset = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: this.hash(token) } });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) throw new BadRequestException('Reset token is invalid or expired');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: await this.passwords.hash(nextPassword) } }),
      this.prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.auditLog.create({ data: { actorUserId: reset.userId, event: 'auth.password.reset', metadata: {} } }),
    ]);
    return { success: true };
  }

  async setupTwoFactor(user: AuthenticatedUser) {
    const secret = randomBytes(20).toString('base64url');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecretCipher: this.encryption.encrypt(secret), twoFactorEnabled: false },
    });
    return { secret, otpauthUrl: `otpauth://totp/NexusHQ:${encodeURIComponent(user.email)}?secret=${secret}&issuer=NexusHQ` };
  }

  async enableTwoFactor(user: AuthenticatedUser, code: string | undefined) {
    if (!code || code.trim().length < 6) throw new BadRequestException('2FA code is required');
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser?.twoFactorSecretCipher) throw new BadRequestException('Call 2fa/setup first');
    const secret = this.encryption.decrypt(dbUser.twoFactorSecretCipher);
    if (!this.verifyTotp(secret, code.trim())) throw new BadRequestException('Invalid 2FA code');
    const backupCodes = Array.from({ length: 8 }, () => randomBytes(4).toString('hex'));
    const hashedCodes = backupCodes.map((c) => this.hash(c));
    await this.prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true, backupCodes: JSON.stringify(hashedCodes) } });
    await this.prisma.auditLog.create({ data: { actorUserId: user.id, tenantId: user.tenantId, event: 'auth.2fa.enabled', metadata: {} } });
    return { success: true, backupCodes };
  }

  async disableTwoFactor(user: AuthenticatedUser, password: string | undefined) {
    if (!password) throw new BadRequestException('password is required to disable 2FA');
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser || !(await this.passwords.verify(password, dbUser.passwordHash))) {
      throw new UnauthorizedException('Invalid password');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecretCipher: null, backupCodes: null },
    });
    await this.prisma.auditLog.create({ data: { actorUserId: user.id, tenantId: user.tenantId, event: 'auth.2fa.disabled', metadata: {} } });
    return { success: true };
  }

  private toPublicUser(
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      initials: string;
      tenantId?: string | null;
      tenantName?: string | null;
      twoFactorEnabled?: boolean;
    },
    tenant?: {
      id: string;
      companyName: string;
      enabledServices: { key: string }[];
    },
  ) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      initials: user.initials,
      tenantId: user.tenantId ?? tenant?.id,
      tenantName: user.tenantName ?? tenant?.companyName,
      twoFactorEnabled: 'twoFactorEnabled' in user ? user.twoFactorEnabled : undefined,
      enabledServices: tenant?.enabledServices.map((service) => service.key) ?? [],
    };
  }

  private verifyTotp(secret: string, code: string): boolean {
    const window = [-1, 0, 1];
    for (const offset of window) {
      const counter = Math.floor(Date.now() / 1000 / 30) + offset;
      const buf = Buffer.alloc(8);
      buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
      buf.writeUInt32BE(counter & 0xffffffff, 4);
      const hmac = createHmac('sha1', Buffer.from(secret, 'base64url')).update(buf).digest();
      const offset2 = hmac[hmac.length - 1] & 0xf;
      const otp = ((hmac[offset2] & 0x7f) << 24 | hmac[offset2 + 1] << 16 | hmac[offset2 + 2] << 8 | hmac[offset2 + 3]) % 1000000;
      if (otp.toString().padStart(6, '0') === code) return true;
    }
    return false;
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
