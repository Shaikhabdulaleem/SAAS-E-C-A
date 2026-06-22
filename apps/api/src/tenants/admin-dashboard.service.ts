import { Injectable } from '@nestjs/common';
import { TenantStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const tenants = await this.prisma.tenant.findMany({
      include: {
        enabledServices: true,
        integrations: true,
      },
    });

    const active = tenants.filter((t) => t.status === TenantStatus.active);
    const trial = tenants.filter((t) => t.status === TenantStatus.trial);
    const onboarding = tenants.filter((t) => t.status === TenantStatus.onboarding);
    const paymentFailed = tenants.filter((t) => t.status === TenantStatus.payment_failed);
    const suspended = tenants.filter((t) => t.status === TenantStatus.suspended);
    const cancelled = tenants.filter((t) => t.status === TenantStatus.cancelled);

    const totalMrr = active.reduce(
      (sum, t) => sum + Number(t.mrr),
      0,
    );

    const activeCount = active.length;
    const cancelledCount = cancelled.length;
    const churnRate =
      activeCount + cancelledCount > 0
        ? (cancelledCount / (activeCount + cancelledCount)) * 100
        : 0;

    const avgMrrPerClient = activeCount > 0 ? totalMrr / activeCount : 0;

    // Plan distribution: group active tenants by plan
    const planMap = new Map<string, { count: number; mrr: number }>();
    for (const t of active) {
      const entry = planMap.get(t.plan) ?? { count: 0, mrr: 0 };
      entry.count += 1;
      entry.mrr += Number(t.mrr);
      planMap.set(t.plan, entry);
    }
    const planDistribution = Array.from(planMap.entries()).map(
      ([plan, { count, mrr }]) => ({ plan, count, mrr }),
    );

    // Top 5 clients by MRR
    const topClients = [...active]
      .sort((a, b) => Number(b.mrr) - Number(a.mrr))
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        companyName: t.companyName,
        plan: t.plan,
        mrr: Number(t.mrr),
        status: t.status,
      }));

    // Expiring trials: within 7 days
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiringTrials = trial
      .filter((t) => t.trialEndsAt != null && t.trialEndsAt <= sevenDaysFromNow)
      .map((t) => {
        const daysRemaining = Math.max(
          0,
          Math.ceil(
            (t.trialEndsAt!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
          ),
        );
        return {
          id: t.id,
          companyName: t.companyName,
          email: t.email,
          trialEndsAt: t.trialEndsAt!,
          daysRemaining,
        };
      });

    // 5 newest sign-ups
    const recentSignups = [...tenants]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        companyName: t.companyName,
        plan: t.plan,
        createdAt: t.createdAt,
      }));

    // MRR history: last 12 months (simplified snapshot)
    const mrrHistory = this.buildMrrHistory(tenants, 12);

    return {
      metrics: {
        totalMrr,
        arr: totalMrr * 12,
        activeCount,
        trialCount: trial.length,
        onboardingCount: onboarding.length,
        paymentFailedCount: paymentFailed.length,
        suspendedCount: suspended.length,
        cancelledCount,
        totalCount: tenants.length,
        churnRate: Math.round(churnRate * 100) / 100,
        avgMrrPerClient: Math.round(avgMrrPerClient * 100) / 100,
      },
      planDistribution,
      topClients,
      expiringTrials,
      recentSignups,
      mrrHistory,
    };
  }

  async revenueAnalytics() {
    const tenants = await this.prisma.tenant.findMany({
      where: { status: TenantStatus.active },
      include: { integrations: true },
    });

    const totalMrr = tenants.reduce((sum, t) => sum + Number(t.mrr), 0);
    const avgRevenuePerAccount = tenants.length > 0 ? totalMrr / tenants.length : 0;

    // Integration cost ratio
    const activeIntegrations = await this.prisma.tenantIntegration.findMany({
      where: { isActive: true },
    });
    const totalIntegrationCost = activeIntegrations.reduce(
      (sum, i) => sum + Number(i.monthlyPrice),
      0,
    );
    const integrationCostRatio =
      totalMrr > 0 ? (totalIntegrationCost / totalMrr) * 100 : 0;

    // MRR history
    const allTenants = await this.prisma.tenant.findMany({
      include: { enabledServices: true, integrations: true },
    });
    const mrrHistory = this.buildMrrHistory(allTenants, 12);

    // Plan breakdown with colors and labels
    const colorMap: Record<string, string> = {
      starter: '#0ea5e9',
      growth: '#6366f1',
      business: '#8b5cf6',
      enterprise: '#10b981',
    };
    const labelMap: Record<string, string> = {
      starter: 'Starter',
      growth: 'Growth',
      business: 'Business',
      enterprise: 'Enterprise',
    };

    const breakdownMap = new Map<
      string,
      { mrr: number; count: number }
    >();
    for (const t of tenants) {
      const entry = breakdownMap.get(t.plan) ?? { mrr: 0, count: 0 };
      entry.mrr += Number(t.mrr);
      entry.count += 1;
      breakdownMap.set(t.plan, entry);
    }
    const planBreakdown = Array.from(breakdownMap.entries()).map(
      ([plan, { mrr, count }]) => ({
        plan,
        label: labelMap[plan] ?? plan,
        mrr,
        count,
        color: colorMap[plan] ?? '#94a3b8',
      }),
    );

    // Top 10 clients by MRR with integration cost and profit
    const topClients = [...tenants]
      .sort((a, b) => Number(b.mrr) - Number(a.mrr))
      .slice(0, 10)
      .map((t) => {
        const integrationCost = t.integrations
          .filter((i) => i.isActive)
          .reduce((sum, i) => sum + Number(i.monthlyPrice), 0);
        return {
          id: t.id,
          companyName: t.companyName,
          mrr: Number(t.mrr),
          integrationCost,
          profit: Number(t.mrr) - integrationCost,
        };
      });

    return {
      metrics: {
        totalMrr,
        netRevenueRetention: 100,
        avgRevenuePerAccount: Math.round(avgRevenuePerAccount * 100) / 100,
        integrationCostRatio: Math.round(integrationCostRatio * 100) / 100,
      },
      mrrHistory,
      planBreakdown,
      topClients,
    };
  }

  async churnRisk() {
    const tenants = await this.prisma.tenant.findMany({
      where: { status: { in: [TenantStatus.active, TenantStatus.trial, TenantStatus.payment_failed] } },
      include: { sendingDomains: { select: { healthScore: true } } },
    });

    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Fetch latest session and recent session count for each tenant's users
    const tenantUsers = await this.prisma.tenantUser.findMany({
      where: { tenantId: { in: tenants.map(t => t.id) } },
      select: { tenantId: true, userId: true },
    });

    const userIdsByTenant = new Map<string, string[]>();
    for (const tu of tenantUsers) {
      const ids = userIdsByTenant.get(tu.tenantId) ?? [];
      ids.push(tu.userId);
      userIdsByTenant.set(tu.tenantId, ids);
    }

    // Fetch all sessions for these users in one query
    const allUserIds = Array.from(userIdsByTenant.values()).flat();
    const sessions = await this.prisma.session.findMany({
      where: { userId: { in: allUserIds } },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const sessionsByUser = new Map<string, Date[]>();
    for (const s of sessions) {
      const dates = sessionsByUser.get(s.userId) ?? [];
      dates.push(s.createdAt);
      sessionsByUser.set(s.userId, dates);
    }

    const results: Array<{
      tenantId: string;
      companyName: string;
      riskScore: number;
      riskFactors: string[];
    }> = [];

    for (const tenant of tenants) {
      const riskFactors: string[] = [];
      let riskScore = 0;

      // Check last login across all tenant users
      const userIds = userIdsByTenant.get(tenant.id) ?? [];
      let lastLogin: Date | null = null;
      let recentSessionCount = 0;

      for (const uid of userIds) {
        const userSessions = sessionsByUser.get(uid) ?? [];
        if (userSessions.length > 0 && (!lastLogin || userSessions[0] > lastLogin)) {
          lastLogin = userSessions[0];
        }
        recentSessionCount += userSessions.filter(d => d >= fourteenDaysAgo).length;
      }

      // No login in 14+ days
      if (!lastLogin || lastLogin < fourteenDaysAgo) {
        riskFactors.push('No login in 14+ days');
        riskScore += 40;
      }

      // Payment failed status
      if (tenant.status === TenantStatus.payment_failed) {
        riskFactors.push('Payment failed');
        riskScore += 35;
      }

      // Low domain health score (avg < 30)
      const domainScores = tenant.sendingDomains.map(d => d.healthScore);
      if (domainScores.length > 0) {
        const avgDomainHealth = Math.round(domainScores.reduce((s, h) => s + h, 0) / domainScores.length);
        if (avgDomainHealth < 30) {
          riskFactors.push(`Low domain health score (${avgDomainHealth})`);
          riskScore += 25;
        }
      }

      // Low engagement (few recent sessions)
      if (recentSessionCount <= 1 && riskScore < 40) {
        riskFactors.push('Very low engagement');
        riskScore += 15;
      }

      if (riskFactors.length > 0) {
        results.push({
          tenantId: tenant.id,
          companyName: tenant.companyName,
          riskScore: Math.min(riskScore, 100),
          riskFactors,
        });
      }
    }

    // Sort by risk score descending
    results.sort((a, b) => b.riskScore - a.riskScore);

    return results;
  }

  /**
   * Build MRR history for the last N months.
   * Simplified snapshot: for each month, sum MRR of tenants created before
   * that month's end that are currently active.
   */
  private buildMrrHistory(
    tenants: Array<{ createdAt: Date; status: string; mrr: Prisma.Decimal | number }>,
    months: number,
  ) {
    const now = new Date();
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];

    const history: Array<{ month: string; mrr: number }> = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
      const label = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;

      const mrr = tenants
        .filter(
          (t) =>
            t.status === TenantStatus.active &&
            t.createdAt <= endOfMonth,
        )
        .reduce((sum, t) => sum + Number(t.mrr), 0);

      history.push({ month: label, mrr });
    }

    return history;
  }
}
