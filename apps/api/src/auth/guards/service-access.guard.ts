import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { REQUIRED_SERVICE_KEY } from '../decorators/required-service.decorator';
import { AuthenticatedUser } from '../types';

@Injectable()
export class ServiceAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const serviceKey = this.reflector.getAllAndOverride<string>(REQUIRED_SERVICE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!serviceKey) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) throw new ForbiddenException('Service access requires authentication');
    if (user.role === UserRole.superadmin) return true;
    if (!user.tenantId) throw new ForbiddenException('Tenant service access is required');

    const enabled = await this.prisma.tenantService.findUnique({
      where: {
        tenantId_key: {
          tenantId: user.tenantId,
          key: serviceKey,
        },
      },
      select: { id: true },
    });

    if (!enabled) throw new ForbiddenException(`Service access denied: ${serviceKey}`);

    return true;
  }
}
