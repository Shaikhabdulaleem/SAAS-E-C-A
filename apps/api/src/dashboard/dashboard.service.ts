import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL = 60_000;

function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = cache.get(key);
  if (entry && entry.expiresAt > now) return Promise.resolve(entry.data as T);
  return fn().then((data) => {
    cache.set(key, { data, expiresAt: now + ttl });
    if (cache.size > 500) {
      for (const [k, v] of cache.entries()) {
        if (v.expiresAt <= now) cache.delete(k);
      }
    }
    return data;
  });
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(tenantId: string, query: Record<string, string> = {}) {
    const cacheKey = `dashboard:${tenantId}:${query.from ?? ''}:${query.to ?? ''}`;
    return cached(cacheKey, CACHE_TTL, async () => {
      const [summary, weeklyActivity, contactStatus, pipeline, campaignPerformance, recentActivities] = await Promise.all([
        this.summary(tenantId, query),
        this.weeklyActivity(tenantId, query),
        this.contactStatus(tenantId),
        this.pipeline(tenantId, query),
        this.campaignPerformance(tenantId, query),
        this.recentActivities(tenantId),
      ]);

      return {
        summary,
        weeklyActivity,
        contactStatus,
        pipeline,
        campaignPerformance,
        recentActivities,
      };
    });
  }

  async summary(tenantId: string, query: Record<string, string> = {}) {
    const range = this.range(query);
    const [contacts, companies, openDeals, campaigns, activities] = await Promise.all([
      this.prisma.contact.count({ where: { tenantId, ...this.createdAt(range) } }),
      this.prisma.company.count({ where: { tenantId, ...this.createdAt(range) } }),
      this.prisma.deal.findMany({ where: { tenantId, status: 'open', ...this.createdAt(range) } }),
      this.prisma.emailCampaign.findMany({ where: { tenantId, status: 'sent', ...this.createdAt(range) } }),
      this.prisma.activity.count({ where: { tenantId, ...this.createdAt(range) } }),
    ]);
    const pipelineValue = openDeals.reduce((sum, deal) => sum + Number(deal.value), 0);
    const weightedPipeline = openDeals.reduce((sum, deal) => sum + Number(deal.value) * (deal.probability / 100), 0);
    const totalRecipients = campaigns.reduce((sum, campaign) => sum + campaign.totalRecipients, 0);
    const totalOpens = campaigns.reduce((sum, campaign) => sum + campaign.openCount, 0);
    const totalClicks = campaigns.reduce((sum, campaign) => sum + campaign.clickCount, 0);
    return {
      contacts,
      companies,
      openDeals: openDeals.length,
      pipelineValue,
      weightedPipeline: Math.round(weightedPipeline * 100) / 100,
      avgDealValue: openDeals.length ? pipelineValue / openDeals.length : 0,
      campaigns: campaigns.length,
      activities,
      openRate: totalRecipients ? (totalOpens / totalRecipients) * 100 : 0,
      clickRate: totalRecipients ? (totalClicks / totalRecipients) * 100 : 0,
    };
  }

  async pipeline(tenantId: string, query: Record<string, string> = {}) {
    const deals = await this.prisma.deal.findMany({ where: { tenantId, status: 'open', ...this.createdAt(this.range(query)) } });
    const byStage = new Map<string, { count: number; value: number; weightedValue: number }>();
    for (const deal of deals) {
      const current = byStage.get(deal.stage) ?? { count: 0, value: 0, weightedValue: 0 };
      current.count += 1;
      current.value += Number(deal.value);
      current.weightedValue += Number(deal.value) * (deal.probability / 100);
      byStage.set(deal.stage, current);
    }
    return Array.from(byStage.entries()).map(([stage, data]) => ({
      stage,
      label: this.titleCase(stage),
      ...data,
    }));
  }

  async campaignPerformance(tenantId: string, query: Record<string, string> = {}) {
    const campaigns = await this.prisma.emailCampaign.findMany({ where: { tenantId, ...this.createdAt(this.range(query)) }, orderBy: { createdAt: 'desc' }, take: 12 });
    return campaigns.reverse().map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      label: campaign.name.length > 12 ? `${campaign.name.slice(0, 12)}...` : campaign.name,
      openRate: campaign.totalRecipients ? (campaign.openCount / campaign.totalRecipients) * 100 : 0,
      clickRate: campaign.totalRecipients ? (campaign.clickCount / campaign.totalRecipients) * 100 : 0,
    }));
  }

  recentActivities(tenantId: string) {
    return this.prisma.activity.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 10 });
  }

  async contactStatus(tenantId: string) {
    const contacts = await this.prisma.contact.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { _all: true },
    });

    return contacts.map((item) => ({
      status: item.status,
      label: this.titleCase(item.status),
      value: item._count._all,
    }));
  }

  async weeklyActivity(tenantId: string, query: Record<string, string> = {}) {
    const selectedRange = this.range(query);
    const today = selectedRange.to ?? new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      date.setHours(0, 0, 0, 0);
      return date;
    });

    const rangeStart = selectedRange.from ?? days[0];
    const rangeEnd = new Date(selectedRange.to ?? days[6]);
    rangeEnd.setDate(rangeEnd.getDate() + 1);

    const [activities, deals] = await Promise.all([
      this.prisma.activity.findMany({
        where: { tenantId, createdAt: { gte: rangeStart, lt: rangeEnd } },
        select: { type: true, createdAt: true },
      }),
      this.prisma.deal.findMany({
        where: { tenantId, createdAt: { gte: rangeStart, lt: rangeEnd } },
        select: { createdAt: true },
      }),
    ]);

    return days.map((dayStart) => {
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const inDay = (value: Date) => value >= dayStart && value < dayEnd;

      return {
        date: dayStart.toISOString(),
        day: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
        calls: activities.filter((activity) => activity.type === 'call' && inDay(activity.createdAt)).length,
        emails: activities.filter((activity) => activity.type.includes('email') && inDay(activity.createdAt)).length,
        deals: deals.filter((deal) => inDay(deal.createdAt)).length,
      };
    });
  }

  async exportCsv(tenantId: string, query: Record<string, string>) {
    const summary = await this.summary(tenantId, query);
    const pipeline = await this.pipeline(tenantId, query);
    const rows = [
      ['Metric', 'Value'],
      ...Object.entries(summary).map(([key, value]) => [key, String(value)]),
      [''],
      ['Stage', 'Count', 'Value', 'Weighted Value'],
      ...pipeline.map((stage) => [stage.label, String(stage.count), String(stage.value), String(Math.round(stage.weightedValue * 100) / 100)]),
    ];
    return rows.map((row) => row.map((cell) => this.csvCell(cell)).join(',')).join('\n');
  }

  private titleCase(value: string) {
    return value
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private range(query: Record<string, string>) {
    return {
      from: this.optionalDate(query.from),
      to: this.optionalDate(query.to),
    };
  }

  private createdAt(range: { from?: Date; to?: Date }) {
    if (!range.from && !range.to) return {};
    return { createdAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } as Prisma.DateTimeFilter };
  }

  private optionalDate(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private csvCell(value: unknown) {
    const text = String(value ?? '');
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
}
