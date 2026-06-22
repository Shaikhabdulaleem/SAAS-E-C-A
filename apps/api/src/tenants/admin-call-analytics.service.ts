import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminCallAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    // CallSession count and avg duration per tenant
    const sessionsByTenant = await this.prisma.callSession.groupBy({
      by: ['tenantId'],
      _count: { id: true },
      _avg: { durationSec: true },
    });

    // CallInsight avg coachingScore and sentiment distribution
    const insights = await this.prisma.callInsight.findMany({
      select: { tenantId: true, coachingScore: true, sentiment: true },
    });

    const sentimentDist: Record<string, number> = {};
    let coachingScoreSum = 0;
    let coachingScoreCount = 0;
    for (const ins of insights) {
      const sent = ins.sentiment ?? 'unknown';
      sentimentDist[sent] = (sentimentDist[sent] ?? 0) + 1;
      if (ins.coachingScore != null) {
        coachingScoreSum += ins.coachingScore;
        coachingScoreCount++;
      }
    }
    const avgCoachingScore = coachingScoreCount > 0 ? Math.round(coachingScoreSum / coachingScoreCount) : 0;

    // CallRecording total hours
    const recordingAgg = await this.prisma.callRecording.aggregate({
      _sum: { durationSec: true },
      _count: { id: true },
    });
    const totalRecordingHours = Math.round(((recordingAgg._sum.durationSec ?? 0) / 3600) * 100) / 100;

    // Join with tenant for company names
    const tenantIds = sessionsByTenant.map(s => s.tenantId);
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true },
    });
    const tenantNameMap = new Map(tenants.map(t => [t.id, t.companyName]));

    // Per-tenant coaching scores
    const tenantCoachingMap = new Map<string, { sum: number; count: number }>();
    for (const ins of insights) {
      if (ins.coachingScore != null) {
        const entry = tenantCoachingMap.get(ins.tenantId) ?? { sum: 0, count: 0 };
        entry.sum += ins.coachingScore;
        entry.count++;
        tenantCoachingMap.set(ins.tenantId, entry);
      }
    }

    const perTenant = sessionsByTenant.map(s => {
      const coaching = tenantCoachingMap.get(s.tenantId);
      return {
        tenantId: s.tenantId,
        companyName: tenantNameMap.get(s.tenantId) ?? 'Unknown',
        sessionCount: s._count.id,
        avgDurationSec: Math.round(s._avg.durationSec ?? 0),
        avgCoachingScore: coaching ? Math.round(coaching.sum / coaching.count) : null,
      };
    });

    return {
      totals: {
        totalSessions: sessionsByTenant.reduce((s, t) => s + t._count.id, 0),
        totalInsights: insights.length,
        avgCoachingScore,
        totalRecordings: recordingAgg._count.id,
        totalRecordingHours,
      },
      sentimentDistribution: sentimentDist,
      perTenant,
    };
  }
}
