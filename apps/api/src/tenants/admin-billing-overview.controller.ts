import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin/billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class AdminBillingOverviewController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('overview')
  async overview() {
    const subscriptions = await this.prisma.billingSubscription.findMany({
      include: {
        tenant: { select: { id: true, companyName: true, plan: true, mrr: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const failedPayments = subscriptions.filter(
      (s) => s.status === 'past_due' || s.status === 'unpaid',
    );

    const upcomingRenewals = subscriptions
      .filter(
        (s) =>
          s.status === 'active' &&
          s.currentPeriodEnd != null &&
          s.currentPeriodEnd.getTime() <= Date.now() + 7 * 24 * 60 * 60 * 1000,
      )
      .sort(
        (a, b) =>
          (a.currentPeriodEnd?.getTime() ?? 0) - (b.currentPeriodEnd?.getTime() ?? 0),
      );

    return {
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        tenantId: s.tenantId,
        companyName: s.tenant.companyName,
        plan: s.tenant.plan,
        mrr: s.tenant.mrr,
        tenantStatus: s.tenant.status,
        subscriptionStatus: s.status,
        seats: s.seats,
        currentPeriodEnd: s.currentPeriodEnd,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        createdAt: s.createdAt,
      })),
      failedPayments: failedPayments.map((s) => ({
        id: s.id,
        tenantId: s.tenantId,
        companyName: s.tenant.companyName,
        status: s.status,
        plan: s.tenant.plan,
      })),
      upcomingRenewals: upcomingRenewals.map((s) => ({
        id: s.id,
        tenantId: s.tenantId,
        companyName: s.tenant.companyName,
        currentPeriodEnd: s.currentPeriodEnd,
        plan: s.tenant.plan,
      })),
      totalActive: subscriptions.filter((s) => s.status === 'active').length,
      totalFailed: failedPayments.length,
      totalUpcoming: upcomingRenewals.length,
    };
  }
}
