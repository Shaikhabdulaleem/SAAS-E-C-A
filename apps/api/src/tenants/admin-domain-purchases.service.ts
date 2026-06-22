import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminDomainPurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(query: Record<string, string>) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 25), 1), 100);

    const where: any = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.status) where.status = query.status;

    const [orders, total] = await Promise.all([
      this.prisma.domainPurchaseOrder.findMany({
        where,
        include: { tenant: { select: { id: true, companyName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.domainPurchaseOrder.count({ where }),
    ]);

    // Pipeline counts by status
    const statusGroups = await this.prisma.domainPurchaseOrder.groupBy({
      by: ['status'],
      _count: { id: true },
    });
    const pipeline: Record<string, number> = {};
    for (const g of statusGroups) {
      pipeline[g.status] = g._count.id;
    }

    // Per-tenant breakdown
    const allOrders = await this.prisma.domainPurchaseOrder.findMany({
      include: { tenant: { select: { id: true, companyName: true } } },
    });

    const tenantMap = new Map<string, { companyName: string; count: number; totalCost: number; completed: number; failed: number }>();
    for (const o of allOrders) {
      const entry = tenantMap.get(o.tenantId) ?? { companyName: o.tenant.companyName, count: 0, totalCost: 0, completed: 0, failed: 0 };
      entry.count++;
      entry.totalCost += Number(o.totalCost);
      if (o.status === 'completed') entry.completed++;
      if (o.status === 'failed') entry.failed++;
      tenantMap.set(o.tenantId, entry);
    }

    const perTenant = Array.from(tenantMap.entries()).map(([tenantId, data]) => ({
      tenantId,
      companyName: data.companyName,
      orderCount: data.count,
      totalCost: Math.round(data.totalCost * 100) / 100,
      successRate: data.count > 0 ? Math.round(((data.completed) / data.count) * 100) : 0,
    }));

    // Failed orders with errors
    const failedOrders = allOrders
      .filter(o => o.status === 'failed' && o.lastError)
      .map(o => ({
        id: o.id,
        tenantId: o.tenantId,
        companyName: o.tenant.companyName,
        baseName: o.baseName,
        lastError: o.lastError,
        createdAt: o.createdAt,
      }));

    return {
      orders: orders.map(o => ({
        ...o,
        totalCost: Number(o.totalCost),
      })),
      pagination: { page, pageSize, total },
      pipeline,
      perTenant,
      failedOrders,
    };
  }
}
