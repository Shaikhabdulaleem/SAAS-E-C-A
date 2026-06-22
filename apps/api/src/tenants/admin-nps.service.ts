import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminNpsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordScore(tenantId: string, data: { score: number; feedback?: string; userId?: string }, actorUserId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const score = Math.min(10, Math.max(0, Math.round(data.score)));
    const category = score >= 9 ? 'promoter' : score >= 7 ? 'passive' : 'detractor';

    const survey = await this.prisma.npsSurvey.create({
      data: { tenantId, userId: data.userId, score, feedback: data.feedback, category },
    });

    await this.prisma.auditLog.create({
      data: { actorUserId, tenantId, event: 'tenant.nps.recorded', metadata: { score, category } as Prisma.InputJsonValue },
    });

    return survey;
  }

  async getSummary() {
    const surveys = await this.prisma.npsSurvey.findMany({
      include: { tenant: { select: { companyName: true } } },
    });

    const promoters = surveys.filter(s => s.category === 'promoter').length;
    const passives = surveys.filter(s => s.category === 'passive').length;
    const detractors = surveys.filter(s => s.category === 'detractor').length;
    const total = surveys.length;
    const npsScore = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;

    const tenantMap = new Map<string, { companyName: string; scores: number[]; latest: number }>();
    for (const s of surveys) {
      const entry = tenantMap.get(s.tenantId) ?? { companyName: s.tenant.companyName, scores: [], latest: 0 };
      entry.scores.push(s.score);
      entry.latest = s.score;
      tenantMap.set(s.tenantId, entry);
    }

    const perTenant = Array.from(tenantMap.entries()).map(([tenantId, data]) => ({
      tenantId,
      companyName: data.companyName,
      avgScore: Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10) / 10,
      latestScore: data.latest,
      responses: data.scores.length,
    }));

    return {
      npsScore,
      total,
      promoters,
      passives,
      detractors,
      perTenant,
    };
  }

  async getTenantNps(tenantId: string) {
    return this.prisma.npsSurvey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
