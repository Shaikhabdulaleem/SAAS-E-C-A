import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminFeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  async listFlags() {
    return this.prisma.featureFlag.findMany({
      include: { tenantFlags: { select: { tenantId: true, enabled: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFlag(data: { key: string; name: string; description?: string; isGlobal?: boolean; defaultOn?: boolean }) {
    return this.prisma.featureFlag.create({
      data: {
        key: data.key,
        name: data.name,
        description: data.description,
        isGlobal: data.isGlobal ?? false,
        defaultOn: data.defaultOn ?? false,
      },
    });
  }

  async updateFlag(id: string, data: { name?: string; description?: string; isGlobal?: boolean; defaultOn?: boolean }) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { id } });
    if (!flag) throw new NotFoundException('Feature flag not found');
    return this.prisma.featureFlag.update({ where: { id }, data });
  }

  async removeFlag(id: string) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { id } });
    if (!flag) throw new NotFoundException('Feature flag not found');
    await this.prisma.featureFlag.delete({ where: { id } });
    return { success: true };
  }

  async getTenantFlags(tenantId: string) {
    const [flags, tenantFlags] = await Promise.all([
      this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } }),
      this.prisma.tenantFeatureFlag.findMany({ where: { tenantId } }),
    ]);

    const overrideMap = new Map(tenantFlags.map(tf => [tf.flagId, tf.enabled]));

    return flags.map(f => ({
      ...f,
      enabled: overrideMap.has(f.id) ? overrideMap.get(f.id) : (f.isGlobal ? f.defaultOn : false),
      hasOverride: overrideMap.has(f.id),
    }));
  }

  async toggleTenantFlag(tenantId: string, flagId: string, enabled: boolean, actorUserId: string) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { id: flagId } });
    if (!flag) throw new NotFoundException('Feature flag not found');

    const result = await this.prisma.tenantFeatureFlag.upsert({
      where: { tenantId_flagId: { tenantId, flagId } },
      create: { tenantId, flagId, enabled },
      update: { enabled },
    });

    await this.prisma.auditLog.create({
      data: { actorUserId, tenantId, event: 'tenant.feature_flag.toggled', metadata: { flagId, flagKey: flag.key, enabled } as Prisma.InputJsonValue },
    });

    return result;
  }
}
