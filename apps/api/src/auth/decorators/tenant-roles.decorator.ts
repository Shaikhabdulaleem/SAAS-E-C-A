import { SetMetadata } from '@nestjs/common';
import { TenantMemberRole } from '@prisma/client';

export const TENANT_ROLES_KEY = 'tenantRoles';
export const TenantRoles = (...roles: TenantMemberRole[]) => SetMetadata(TENANT_ROLES_KEY, roles);
