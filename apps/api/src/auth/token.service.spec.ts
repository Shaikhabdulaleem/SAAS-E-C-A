import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { TokenService } from './token.service';

describe('TokenService', () => {
  const service = new TokenService(new ConfigService({
    JWT_ACCESS_SECRET: 'test-access-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
  }));

  it('signs and verifies access tokens', () => {
    const token = service.signAccessToken({
      sub: 'u1',
      email: 'admin@nexushq.com',
      role: UserRole.superadmin,
      tenantId: 't1',
    });

    const payload = service.verifyAccessToken(token);

    expect(payload.sub).toBe('u1');
    expect(payload.email).toBe('admin@nexushq.com');
    expect(payload.role).toBe(UserRole.superadmin);
    expect(payload.tenantId).toBe('t1');
  });

  it('hashes opaque refresh tokens deterministically', () => {
    const token = service.createOpaqueToken();

    expect(service.hashOpaqueToken(token)).toBe(service.hashOpaqueToken(token));
    expect(service.hashOpaqueToken(token)).not.toBe(token);
  });
});
