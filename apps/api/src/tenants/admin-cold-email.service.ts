import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminColdEmailService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    const [domains, mailboxes, healthLogs] = await Promise.all([
      this.prisma.sendingDomain.findMany({
        include: { tenant: { select: { id: true, companyName: true } } },
      }),
      this.prisma.coldMailbox.findMany({
        select: { tenantId: true, warmupStatus: true, healthScore: true, bounceRate: true, spamRate: true, status: true },
      }),
      this.prisma.domainHealthLog.findMany({
        orderBy: { checkedAt: 'desc' },
        take: 500,
      }),
    ]);

    const totalDomains = domains.length;
    const avgHealth = totalDomains > 0 ? Math.round(domains.reduce((s, d) => s + d.healthScore, 0) / totalDomains) : 0;
    const blacklisted = domains.filter(d => d.blacklistStatus !== 'clean').length;
    const dnsCompliant = domains.filter(d => d.spfStatus === 'verified' && d.dkimStatus === 'verified' && d.dmarcStatus === 'verified').length;
    const dnsCompliancePercent = totalDomains > 0 ? Math.round((dnsCompliant / totalDomains) * 100) : 0;

    const warmupCounts = { not_started: 0, warming: 0, ready: 0, paused: 0 };
    for (const mb of mailboxes) {
      if (warmupCounts[mb.warmupStatus] !== undefined) warmupCounts[mb.warmupStatus]++;
    }

    // Per-tenant breakdown
    const tenantMap = new Map<string, { companyName: string; domains: number; avgHealth: number; healthSum: number; mailboxes: number }>();
    for (const d of domains) {
      const entry = tenantMap.get(d.tenantId) ?? { companyName: d.tenant.companyName, domains: 0, avgHealth: 0, healthSum: 0, mailboxes: 0 };
      entry.domains++;
      entry.healthSum += d.healthScore;
      tenantMap.set(d.tenantId, entry);
    }
    for (const mb of mailboxes) {
      const entry = tenantMap.get(mb.tenantId);
      if (entry) entry.mailboxes++;
    }
    const perTenant = Array.from(tenantMap.entries()).map(([tenantId, data]) => ({
      tenantId,
      companyName: data.companyName,
      domains: data.domains,
      avgHealth: data.domains > 0 ? Math.round(data.healthSum / data.domains) : 0,
      mailboxes: data.mailboxes,
    }));

    return {
      metrics: { totalDomains, avgHealth, blacklisted, dnsCompliancePercent, totalMailboxes: mailboxes.length },
      warmupCounts,
      perTenant,
    };
  }

  async getRepliesSummary() {
    const replies = await this.prisma.coldReply.findMany({
      include: { tenant: { select: { companyName: true } } },
    });

    const tenantMap = new Map<string, { companyName: string; total: number; responded: number; categories: Record<string, number> }>();
    for (const r of replies) {
      const entry = tenantMap.get(r.tenantId) ?? { companyName: r.tenant.companyName, total: 0, responded: 0, categories: {} };
      entry.total++;
      if (r.respondedAt) entry.responded++;
      entry.categories[r.category] = (entry.categories[r.category] ?? 0) + 1;
      tenantMap.set(r.tenantId, entry);
    }

    const perTenant = Array.from(tenantMap.entries()).map(([tenantId, data]) => ({
      tenantId,
      ...data,
      responseRate: data.total > 0 ? Math.round((data.responded / data.total) * 100) : 0,
    }));

    const categoryBreakdown: Record<string, number> = {};
    for (const r of replies) {
      categoryBreakdown[r.category] = (categoryBreakdown[r.category] ?? 0) + 1;
    }

    return { totalReplies: replies.length, categoryBreakdown, perTenant };
  }
}
