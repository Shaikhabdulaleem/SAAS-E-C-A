import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminAiUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsageSummary() {
    // Aggregate AiUsageEvent by tenant
    const byTenant = await this.prisma.aiUsageEvent.groupBy({
      by: ['tenantId'],
      _sum: { tokens: true },
      _count: { id: true },
    });

    // Aggregate AiUsageEvent by model
    const byModel = await this.prisma.aiUsageEvent.groupBy({
      by: ['model'],
      _sum: { tokens: true },
      _count: { id: true },
    });

    // CallInsight totals
    const callInsightAgg = await this.prisma.callInsight.aggregate({
      _sum: { costEstimate: true, tokens: true },
      _count: { id: true },
    });

    // Daily trend over last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentEvents = await this.prisma.aiUsageEvent.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { tokens: true, createdAt: true },
    });

    const dailyMap = new Map<string, { tokens: number; count: number }>();
    for (const evt of recentEvents) {
      const day = evt.createdAt.toISOString().slice(0, 10);
      const entry = dailyMap.get(day) ?? { tokens: 0, count: 0 };
      entry.tokens += evt.tokens;
      entry.count++;
      dailyMap.set(day, entry);
    }
    const dailyTrend = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Join with tenant for company names
    const tenantIds = byTenant.map(t => t.tenantId);
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true },
    });
    const tenantNameMap = new Map(tenants.map(t => [t.id, t.companyName]));

    const perTenant = byTenant.map(t => ({
      tenantId: t.tenantId,
      companyName: tenantNameMap.get(t.tenantId) ?? 'Unknown',
      totalTokens: t._sum.tokens ?? 0,
      eventCount: t._count.id,
    }));

    const perModel = byModel.map(m => ({
      model: m.model ?? 'unknown',
      totalTokens: m._sum.tokens ?? 0,
      eventCount: m._count.id,
    }));

    return {
      totals: {
        aiTokens: perTenant.reduce((s, t) => s + t.totalTokens, 0),
        aiEvents: perTenant.reduce((s, t) => s + t.eventCount, 0),
        callInsightCost: Number(callInsightAgg._sum.costEstimate ?? 0),
        callInsightTokens: callInsightAgg._sum.tokens ?? 0,
        callInsightCount: callInsightAgg._count.id,
      },
      perTenant,
      perModel,
      dailyTrend,
    };
  }
}
