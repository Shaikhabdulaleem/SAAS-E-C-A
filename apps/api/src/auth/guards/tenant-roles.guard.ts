import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantMemberRole, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TENANT_ROLES_KEY } from '../decorators/tenant-roles.decorator';
import { AuthenticatedUser } from '../types';

@Injectable()
export class TenantRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<TenantMemberRole[]>(TENANT_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles?.length) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser; headers?: Record<string, string> }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Authentication required');
    if (user.role === UserRole.superadmin) return true;

    const tenantId = user.tenantId ?? request.headers?.['x-tenant-id'];
    if (!tenantId) throw new ForbiddenException('Tenant context required');

    const membership = await this.prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      select: { role: true },
    });

    if (!membership || !roles.includes(membership.role)) {
      throw new ForbiddenException('Insufficient tenant permissions');
    }

    return true;
  }
}
