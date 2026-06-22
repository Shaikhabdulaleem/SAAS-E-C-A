import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma, TenantStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async broadcast(
    title: string,
    body: string,
    statusFilter: string | undefined,
    actorUserId: string,
  ) {
    const where: Prisma.TenantWhereInput = {};
    if (statusFilter && statusFilter !== 'all') {
      where.status = statusFilter as TenantStatus;
    }

    const tenants = await this.prisma.tenant.findMany({
      where,
      select: { id: true },
    });

    let notificationCount = 0;

    for (const tenant of tenants) {
      const members = await this.prisma.tenantUser.findMany({
        where: { tenantId: tenant.id },
        select: { userId: true },
      });

      if (members.length > 0) {
        await this.prisma.notification.createMany({
          data: members.map((m) => ({
            tenantId: tenant.id,
            userId: m.userId,
            type: NotificationType.system,
            title,
            body,
          })),
        });
        notificationCount += members.length;
      }
    }

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        event: 'admin.notification.broadcast',
        metadata: {
          title,
          tenantCount: tenants.length,
          notificationCount,
          statusFilter: statusFilter ?? 'all',
        },
      },
    });

    return {
      success: true,
      tenantCount: tenants.length,
      notificationCount,
    };
  }

  async listSent(limit: number) {
    const notifications = await this.prisma.notification.findMany({
      where: { type: NotificationType.system },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        tenant: { select: { companyName: true } },
      },
    });

    return notifications.map((n) => ({
      id: n.id,
      tenantId: n.tenantId,
      companyName: n.tenant?.companyName ?? null,
      title: n.title,
      body: n.body,
      readAt: n.readAt,
      createdAt: n.createdAt,
    }));
  }
}
