import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantStatus, TenantMemberRole, Prisma, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminTenantExtrasService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth(tenantId: string) {
    await this.ensureTenant(tenantId);

    const [
      tenant,
      lastSession,
      recentSessions,
      contactCount,
      dealCount,
      campaignCount,
      coldCampaignCount,
      memberCount,
    ] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { enabledServices: true },
      }),
      this.prisma.session.findFirst({
        where: { user: { memberships: { some: { tenantId } } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.session.count({
        where: {
          user: { memberships: { some: { tenantId } } },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.contact.count({ where: { tenantId } }),
      this.prisma.deal.count({ where: { tenantId } }),
      this.prisma.emailCampaign.count({ where: { tenantId } }),
      this.prisma.coldCampaign.count({ where: { tenantId } }),
      this.prisma.tenantUser.count({ where: { tenantId } }),
    ]);

    const enabledCount = tenant?.enabledServices.length ?? 0;

    const servicesUsed: string[] = [];
    if (contactCount > 0 || dealCount > 0) servicesUsed.push('crm');
    if (campaignCount > 0) servicesUsed.push('email_marketing');
    if (coldCampaignCount > 0) servicesUsed.push('cold_email');

    const featureAdoption = enabledCount > 0 ? (servicesUsed.length / enabledCount) * 100 : 0;

    const loginRecencyScore = this.computeLoginRecency(lastSession?.createdAt ?? null);
    const dataVolumeScore = Math.min(100, (contactCount + dealCount + campaignCount) * 2);
    const healthScore = Math.round(
      loginRecencyScore * 0.4 + featureAdoption * 0.3 + dataVolumeScore * 0.3,
    );

    return {
      healthScore,
      lastLogin: lastSession?.createdAt ?? null,
      activeUsersLast7Days: recentSessions,
      totalMembers: memberCount,
      servicesEnabled: enabledCount,
      servicesUsed: servicesUsed.length,
      servicesUsedList: servicesUsed,
      featureAdoption: Math.round(featureAdoption),
      dataVolumes: {
        contacts: contactCount,
        deals: dealCount,
        emailCampaigns: campaignCount,
        coldCampaigns: coldCampaignCount,
      },
    };
  }

  async getUsage(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { seats: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const [
      usageRecords,
      contactCount,
      dealCount,
      campaignCount,
      emailsSent,
      aiTokens,
      seatsUsed,
    ] = await Promise.all([
      this.prisma.usageRecord.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.contact.count({ where: { tenantId } }),
      this.prisma.deal.count({ where: { tenantId } }),
      this.prisma.emailCampaign.count({ where: { tenantId } }),
      this.prisma.emailCampaign.aggregate({
        where: { tenantId },
        _sum: { totalRecipients: true },
      }),
      this.prisma.aiUsageEvent.aggregate({
        where: { tenantId },
        _sum: { tokens: true },
      }),
      this.prisma.tenantUser.count({ where: { tenantId } }),
    ]);

    return {
      seats: { used: seatsUsed, total: tenant.seats },
      contacts: contactCount,
      deals: dealCount,
      campaigns: campaignCount,
      emailsSent: emailsSent._sum.totalRecipients ?? 0,
      aiTokensUsed: aiTokens._sum.tokens ?? 0,
      usageRecords,
    };
  }

  async getOnboarding(tenantId: string) {
    await this.ensureTenant(tenantId);

    const items = await this.prisma.onboardingItem.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    const completed = items.filter((i) => i.completedAt !== null).length;

    return {
      items,
      completed,
      total: items.length,
    };
  }

  async getMembers(tenantId: string) {
    await this.ensureTenant(tenantId);

    return this.prisma.tenantUser.findMany({
      where: { tenantId },
      include: {
        user: {
          select: { id: true, name: true, email: true, initials: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateMemberRole(tenantId: string, userId: string, role: string, actorUserId: string) {
    await this.ensureTenant(tenantId);
    const validRoles = Object.values(TenantMemberRole);
    if (!validRoles.includes(role as TenantMemberRole)) {
      throw new NotFoundException('Invalid role');
    }

    const updated = await this.prisma.tenantUser.update({
      where: { tenantId_userId: { tenantId, userId } },
      data: { role: role as TenantMemberRole },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await this.audit(actorUserId, tenantId, 'team.member.role_changed', { userId, role });

    return updated;
  }

  async removeMember(tenantId: string, userId: string, actorUserId: string) {
    await this.ensureTenant(tenantId);

    await this.prisma.tenantUser.delete({
      where: { tenantId_userId: { tenantId, userId } },
    });

    await this.audit(actorUserId, tenantId, 'team.member.removed', { userId });

    return { success: true };
  }

  async getBilling(tenantId: string) {
    await this.ensureTenant(tenantId);

    const [subscription, invoices, paymentMethods] = await Promise.all([
      this.prisma.billingSubscription.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.paymentMethodRef.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { subscription, invoices, paymentMethods };
  }

  async notifyTenant(
    tenantId: string,
    title: string,
    body: string,
    actorUserId: string,
  ) {
    await this.ensureTenant(tenantId);

    const members = await this.prisma.tenantUser.findMany({
      where: { tenantId },
      select: { userId: true },
    });

    await this.prisma.notification.createMany({
      data: members.map((m) => ({
        tenantId,
        userId: m.userId,
        type: NotificationType.system,
        title,
        body,
      })),
    });

    await this.audit(actorUserId, tenantId, 'admin.notification.sent', {
      title,
      recipientCount: members.length,
    });

    return { success: true, recipientCount: members.length };
  }

  private computeLoginRecency(lastLogin: Date | null): number {
    if (!lastLogin) return 0;
    const daysSince = (Date.now() - lastLogin.getTime()) / (24 * 60 * 60 * 1000);
    if (daysSince <= 1) return 100;
    if (daysSince <= 3) return 80;
    if (daysSince <= 7) return 60;
    if (daysSince <= 14) return 40;
    if (daysSince <= 30) return 20;
    return 5;
  }

  async exportTenantData(tenantId: string, actorUserId: string) {
    const tenant = await this.ensureTenant(tenantId);

    const [contacts, companies, deals, activities, campaigns, coldCampaigns, members] = await Promise.all([
      this.prisma.contact.findMany({ where: { tenantId } }),
      this.prisma.company.findMany({ where: { tenantId } }),
      this.prisma.deal.findMany({ where: { tenantId } }),
      this.prisma.activity.findMany({ where: { tenantId }, take: 1000 }),
      this.prisma.emailCampaign.findMany({ where: { tenantId } }),
      this.prisma.coldCampaign.findMany({ where: { tenantId } }),
      this.prisma.tenantUser.findMany({ where: { tenantId }, include: { user: { select: { name: true, email: true } } } }),
    ]);

    await this.audit(actorUserId, tenantId, 'tenant.data.exported', { contactCount: contacts.length });

    return {
      exportedAt: new Date().toISOString(),
      tenant: { id: tenant.id, companyName: (tenant as any).companyName },
      contacts,
      companies,
      deals,
      activities,
      campaigns,
      coldCampaigns,
      members,
    };
  }

  async gdprDelete(tenantId: string, actorUserId: string) {
    await this.ensureTenant(tenantId);

    await this.prisma.$transaction(async (tx) => {
      await tx.contact.updateMany({
        where: { tenantId },
        data: { firstName: 'REDACTED', lastName: 'REDACTED', email: 'redacted@deleted.local', phone: null, jobTitle: null },
      });
      await tx.activity.deleteMany({ where: { tenantId } });

      await tx.auditLog.create({
        data: { actorUserId, tenantId, event: 'tenant.gdpr.deleted', metadata: {} },
      });
    });

    return { success: true, message: 'Personal data has been anonymized' };
  }

  private async ensureTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  private audit(actorUserId: string, tenantId: string, event: string, metadata: Prisma.InputJsonValue) {
    return this.prisma.auditLog.create({
      data: { actorUserId, tenantId, event, metadata },
    });
  }
}
