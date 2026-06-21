import { UserRole } from '@prisma/client';

export interface TokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  tenantId?: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  tenantId?: string;
}
