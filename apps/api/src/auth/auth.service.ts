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

    if (!user || !(await this.passwords.verify(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
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
    const user = await this.prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash: await this.passwords.hash(password),
        role: UserRole.client,
        initials: initials || 'U',
      },
    });
    await this.prisma.auditLog.create({ data: { actorUserId: user.id, event: 'auth.user.registered', metadata: { email: normalizedEmail } } });
    const userWithMemberships = { ...user, memberships: [] as Array<{ tenant: { id: string; companyName: string; enabledServices: { key: string }[] } }> };
    return this.issueTokens(userWithMemberships, meta);
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
    return { success: true };
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
