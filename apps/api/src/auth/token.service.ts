import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'crypto';
import { TokenPayload } from './types';

interface SignedTokenPayload extends TokenPayload {
  exp: number;
  iat: number;
}

@Injectable()
export class TokenService {
  readonly accessTokenTtlSeconds = 15 * 60;
  private readonly refreshTokenTtlDays = 30;

  constructor(private readonly config: ConfigService) {}

  signAccessToken(payload: TokenPayload) {
    const now = Math.floor(Date.now() / 1000);
    const body: SignedTokenPayload = {
      ...payload,
      iat: now,
      exp: now + this.accessTokenTtlSeconds,
    };

    const header = this.base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const encodedPayload = this.base64url(JSON.stringify(body));
    const signature = this.sign(`${header}.${encodedPayload}`);

    return `${header}.${encodedPayload}.${signature}`;
  }

  verifyAccessToken(token: string): SignedTokenPayload {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) {
      throw new UnauthorizedException('Invalid access token');
    }

    const expected = this.sign(`${header}.${payload}`);
    if (signature !== expected) {
      throw new UnauthorizedException('Invalid access token');
    }

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SignedTokenPayload;
    if (!decoded.sub || !decoded.email || !decoded.role || decoded.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Expired or invalid access token');
    }

    return decoded;
  }

  createOpaqueToken() {
    return randomBytes(48).toString('base64url');
  }

  hashOpaqueToken(token: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_REFRESH_SECRET'))
      .update(token)
      .digest('hex');
  }

  getRefreshExpiry() {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenTtlDays);
    return expiresAt;
  }

  extractBearerToken(authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) return null;
    return authorization.slice('Bearer '.length).trim();
  }

  private sign(value: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_ACCESS_SECRET'))
      .update(value)
      .digest('base64url');
  }

  private base64url(value: string) {
    return Buffer.from(value).toString('base64url');
  }
}
