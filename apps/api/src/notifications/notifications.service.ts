import { BadRequestException, Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, userId: string, query: Record<string, string>) {
    return this.prisma.notification.findMany({
      where: {
        tenantId,
        OR: [{ userId }, { userId: null }],
        ...(query.unread === 'true' ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(Number(query.pageSize ?? 50), 1), 100),
    });
  }

  markRead(tenantId: string, userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, tenantId, OR: [{ userId }, { userId: null }] },
      data: { readAt: new Date() },
    });
  }

  markAllRead(tenantId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { tenantId, OR: [{ userId }, { userId: null }], readAt: null },
      data: { readAt: new Date() },
    });
  }

  preferences(tenantId: string, userId: string) {
    return this.prisma.notificationPreference.findMany({ where: { tenantId, userId }, orderBy: { type: 'asc' } });
  }

  async updatePreferences(tenantId: string, userId: string, body: Record<string, unknown>) {
    const preferences = Array.isArray(body.preferences) ? body.preferences : [];
    for (const pref of preferences) {
      if (!pref || typeof pref !== 'object') continue;
      const item = pref as Record<string, unknown>;
      const type = this.type(item.type);
      await this.prisma.notificationPreference.upsert({
        where: { tenantId_userId_type: { tenantId, userId, type } },
        create: {
          tenantId,
          userId,
          type,
          inApp: item.inApp !== false,
          email: item.email === true,
        },
        update: {
          inApp: item.inApp !== false,
          email: item.email === true,
        },
      });
    }
    return this.preferences(tenantId, userId);
  }

  async getUnreadCount(tenantId: string, userId: string) {
    const count = await this.prisma.notification.count({
      where: { tenantId, OR: [{ userId }, { userId: null }], readAt: null },
    });
    return { count };
  }

  async create(input: { tenantId: string; userId?: string; type: NotificationType; title: string; body?: string; metadata?: Record<string, unknown> }) {
    if (input.userId) {
      const pref = await this.prisma.notificationPreference.findUnique({
        where: { tenantId_userId_type: { tenantId: input.tenantId, userId: input.userId, type: input.type } },
      });
      if (pref && !pref.inApp) return null;
    }
    return this.prisma.notification.create({ data: { ...input, metadata: input.metadata as Prisma.InputJsonValue | undefined } });
  }

  private type(value: unknown) {
    if (typeof value !== 'string' || !Object.values(NotificationType).includes(value as NotificationType)) {
      throw new BadRequestException(`type must be one of: ${Object.values(NotificationType).join(', ')}`);
    }
    return value as NotificationType;
  }
}
