import { Injectable } from '@nestjs/common';
import { TenantStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminBenchmarksService {
  constructor(private readonly prisma: PrismaService) {}

  async getBenchmarks() {
    const tenants = await this.prisma.tenant.findMany({
      where: { status: TenantStatus.active },
      include: { enabledServices: true },
    });

    const planGroups = new Map<string, Array<{ id: string; companyName: string; mrr: number; services: number; seats: number }>>();
    for (const t of tenants) {
      const group = planGroups.get(t.plan) ?? [];
      group.push({ id: t.id, companyName: t.companyName, mrr: Number(t.mrr), services: t.enabledServices.length, seats: t.seats });
      planGroups.set(t.plan, group);
    }

    const planAverages = Array.from(planGroups.entries()).map(([plan, group]) => {
      const avgMrr = group.reduce((s, t) => s + t.mrr, 0) / group.length;
      const avgServices = group.reduce((s, t) => s + t.services, 0) / group.length;
      const avgSeats = group.reduce((s, t) => s + t.seats, 0) / group.length;
      return {
        plan,
        count: group.length,
        avgMrr: Math.round(avgMrr * 100) / 100,
        avgServices: Math.round(avgServices * 10) / 10,
        avgSeats: Math.round(avgSeats * 10) / 10,
      };
    });

    const tenantRankings = tenants.map((t) => {
      const group = planGroups.get(t.plan) ?? [];
      const sortedByMrr = [...group].sort((a, b) => a.mrr - b.mrr);
      const mrrRank = sortedByMrr.findIndex((x) => x.id === t.id);
      const mrrPercentile = group.length > 1 ? Math.round((mrrRank / (group.length - 1)) * 100) : 50;

      return {
        tenantId: t.id,
        companyName: t.companyName,
        plan: t.plan,
        mrr: Number(t.mrr),
        services: t.enabledServices.length,
        seats: t.seats,
        mrrPercentile,
      };
    });

    return { planAverages, tenantRankings };
  }

  async compareTenants(ids: string[]) {
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: ids } },
      include: { enabledServices: true, integrations: true },
    });

    const results = await Promise.all(
      tenants.map(async (t) => {
        const [contacts, deals, campaigns, members] = await Promise.all([
          this.prisma.contact.count({ where: { tenantId: t.id } }),
          this.prisma.deal.count({ where: { tenantId: t.id } }),
          this.prisma.emailCampaign.count({ where: { tenantId: t.id } }),
          this.prisma.tenantUser.count({ where: { tenantId: t.id } }),
        ]);

        return {
          tenantId: t.id,
          companyName: t.companyName,
          plan: t.plan,
          status: t.status,
          mrr: Number(t.mrr),
          seats: t.seats,
          servicesEnabled: t.enabledServices.length,
          integrations: t.integrations.length,
          contacts,
          deals,
          campaigns,
          members,
        };
      }),
    );

    return results;
  }
}
