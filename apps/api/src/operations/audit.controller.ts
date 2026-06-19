import { Controller, Get, Headers, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { resolveTenantId } from '../common/tenant-context';
import { PrismaService } from '../prisma/prisma.service';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditLogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string>,
    @Headers('x-tenant-id') selectedTenantId?: string,
  ) {
    const tenantId = resolveTenantId(user, selectedTenantId);
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 50), 1), 100);

    return this.prisma.auditLog.findMany({
      where: {
        tenantId,
        ...(query.event ? { event: { contains: query.event } } : {}),
        ...(query.userId ? { actorUserId: query.userId } : {}),
        ...(query.from ? { createdAt: { gte: new Date(query.from) } } : {}),
        ...(query.to ? { createdAt: { lte: new Date(query.to) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }
}
