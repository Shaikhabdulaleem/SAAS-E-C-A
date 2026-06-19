import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(tenantId: string) {
    const [summary, weeklyActivity, contactStatus, pipeline, campaignPerformance, recentActivities] = await Promise.all([
      this.summary(tenantId),
      this.weeklyActivity(tenantId),
      this.contactStatus(tenantId),
      this.pipeline(tenantId),
      this.campaignPerformance(tenantId),
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
  }

  async summary(tenantId: string) {
    const [contacts, companies, openDeals, campaigns, activities] = await Promise.all([
      this.prisma.contact.count({ where: { tenantId } }),
      this.prisma.company.count({ where: { tenantId } }),
      this.prisma.deal.findMany({ where: { tenantId, status: 'open' } }),
      this.prisma.emailCampaign.findMany({ where: { tenantId, status: 'sent' } }),
      this.prisma.activity.count({ where: { tenantId } }),
    ]);
    const pipelineValue = openDeals.reduce((sum, deal) => sum + Number(deal.value), 0);
    const totalRecipients = campaigns.reduce((sum, campaign) => sum + campaign.totalRecipients, 0);
    const totalOpens = campaigns.reduce((sum, campaign) => sum + campaign.openCount, 0);
    const totalClicks = campaigns.reduce((sum, campaign) => sum + campaign.clickCount, 0);
    return {
      contacts,
      companies,
      openDeals: openDeals.length,
      pipelineValue,
      avgDealValue: openDeals.length ? pipelineValue / openDeals.length : 0,
      campaigns: campaigns.length,
      activities,
      openRate: totalRecipients ? (totalOpens / totalRecipients) * 100 : 0,
      clickRate: totalRecipients ? (totalClicks / totalRecipients) * 100 : 0,
    };
  }

  async pipeline(tenantId: string) {
    const deals = await this.prisma.deal.findMany({ where: { tenantId, status: 'open' } });
    const byStage = new Map<string, { count: number; value: number }>();
    for (const deal of deals) {
      const current = byStage.get(deal.stage) ?? { count: 0, value: 0 };
      current.count += 1;
      current.value += Number(deal.value);
      byStage.set(deal.stage, current);
    }
    return Array.from(byStage.entries()).map(([stage, data]) => ({
      stage,
      label: this.titleCase(stage),
      ...data,
    }));
  }

  async campaignPerformance(tenantId: string) {
    const campaigns = await this.prisma.emailCampaign.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 12 });
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

  async weeklyActivity(tenantId: string) {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      date.setHours(0, 0, 0, 0);
      return date;
    });

    const rangeStart = days[0];
    const rangeEnd = new Date(days[6]);
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

  private titleCase(value: string) {
    return value
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
