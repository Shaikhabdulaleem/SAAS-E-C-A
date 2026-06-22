import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminActivityFeedService {
  constructor(private readonly prisma: PrismaService) {}

  async getFeed(query: Record<string, string>) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 25), 1), 100);

    const where: any = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.type) where.event = { contains: query.type };
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    // Also fetch recent sessions for login activity
    const recentSessions = await this.prisma.session.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      include: { user: { select: { name: true, email: true, tenantId: true, tenantName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const loginEvents = recentSessions.map(s => ({
      id: s.id,
      type: 'login',
      actorUserId: s.userId,
      actorName: s.user.name,
      tenantId: s.user.tenantId,
      tenantName: s.user.tenantName,
      event: 'user.login',
      metadata: null,
      createdAt: s.createdAt,
    }));

    return {
      items: items.map(i => ({ ...i, type: 'audit' })),
      loginEvents: query.tenantId ? loginEvents.filter(e => e.tenantId === query.tenantId) : loginEvents,
      pagination: { page, pageSize, total },
    };
  }
}
