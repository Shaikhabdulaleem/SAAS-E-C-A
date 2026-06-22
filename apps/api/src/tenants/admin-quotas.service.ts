import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminQuotasService {
  constructor(private readonly prisma: PrismaService) {}

  async getQuotas(tenantId: string) {
    await this.ensureTenant(tenantId);
    return this.prisma.tenantQuota.findMany({
      where: { tenantId },
      orderBy: { resource: 'asc' },
    });
  }

  async upsertQuotas(tenantId: string, quotas: Array<{ resource: string; limitValue: number; warnAt?: number }>, actorUserId: string) {
    await this.ensureTenant(tenantId);

    const results = await this.prisma.$transaction(
      quotas.map((q) =>
        this.prisma.tenantQuota.upsert({
          where: { tenantId_resource: { tenantId, resource: q.resource } },
          create: { tenantId, resource: q.resource, limitValue: q.limitValue, warnAt: q.warnAt },
          update: { limitValue: q.limitValue, warnAt: q.warnAt },
        }),
      ),
    );

    await this.prisma.auditLog.create({
      data: { actorUserId, tenantId, event: 'tenant.quotas.updated', metadata: { resources: quotas.map((q) => q.resource) } as Prisma.InputJsonValue },
    });

    return results;
  }

  private async ensureTenant(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!t) throw new NotFoundException('Tenant not found');
  }
}
