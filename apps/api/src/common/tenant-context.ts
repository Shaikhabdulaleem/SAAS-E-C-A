import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types';

export function resolveTenantId(user: AuthenticatedUser, selectedTenantId?: string, adminImpersonation?: string) {
  if (user.tenantId) return user.tenantId;
  if (user.role === UserRole.superadmin && selectedTenantId && adminImpersonation === 'true') return selectedTenantId;
  throw new BadRequestException('Tenant context is required');
}
