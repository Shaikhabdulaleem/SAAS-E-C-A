import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types';
import { resolveTenantId } from '../common/tenant-context';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../providers/services/jobs.service';

@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
  ) {}

  jobs(user: AuthenticatedUser, query: Record<string, string>, selectedTenantId?: string) {
    const tenantId = user.role === UserRole.superadmin && !selectedTenantId ? undefined : resolveTenantId(user, selectedTenantId);
    return this.jobsService.list(tenantId, query);
  }

  providers(user: AuthenticatedUser, query: Record<string, string>, selectedTenantId?: string) {
    const tenantId = user.role === UserRole.superadmin && !selectedTenantId ? undefined : resolveTenantId(user, selectedTenantId);
    return this.prisma.providerLog.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ...(query.provider ? { provider: query.provider } : {}),
        ...(query.status ? { status: query.status as 'success' | 'failed' | 'pending' } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(Number(query.pageSize ?? 100), 1), 200),
    });
  }

  async tenantHealth(user: AuthenticatedUser, selectedTenantId?: string) {
    const tenantId = resolveTenantId(user, selectedTenantId);
    const [failedJobs, providerFailures, unreadNotifications, unhealthyDomains] = await Promise.all([
      this.prisma.jobLog.count({ where: { tenantId, status: 'failed' } }),
      this.prisma.providerLog.count({ where: { tenantId, status: 'failed' } }),
      this.prisma.notification.count({ where: { tenantId, readAt: null } }),
      this.prisma.sendingDomain.count({ where: { tenantId, healthScore: { lt: 70 } } }),
    ]);
    return { failedJobs, providerFailures, unreadNotifications, unhealthyDomains };
  }
}
