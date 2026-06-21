import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const checklist = [
  ['create_organization', 'Create organization'],
  ['invite_team', 'Invite team'],
  ['configure_billing', 'Configure billing'],
  ['import_crm_data', 'Import CRM data'],
  ['connect_email_provider', 'Connect email provider'],
  ['add_domain', 'Add domain'],
  ['verify_dns', 'Verify DNS'],
  ['provision_mailboxes', 'Provision mailboxes'],
  ['warm_up_mailboxes', 'Warm up mailboxes'],
  ['launch_first_campaign', 'Launch first campaign'],
] as const;

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string) {
    await this.ensureItems(tenantId);
    const items = await this.prisma.onboardingItem.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
    return {
      items,
      completed: items.filter((item) => item.completedAt).length,
      total: items.length,
    };
  }

  async update(tenantId: string, body: Record<string, unknown>) {
    await this.ensureItems(tenantId);
    const items = Array.isArray(body.items) ? body.items : [];
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const key = typeof row.key === 'string' ? row.key : undefined;
      if (!key) continue;
      await this.prisma.onboardingItem.update({
        where: { tenantId_key: { tenantId, key } },
        data: {
          completedAt: row.completed ? new Date() : null,
          metadata: this.json(row.metadata),
        },
      }).catch(() => undefined);
    }
    return this.get(tenantId);
  }

  async complete(tenantId: string, key: string, body: Record<string, unknown>) {
    await this.ensureItems(tenantId);
    return this.prisma.onboardingItem.update({
      where: { tenantId_key: { tenantId, key } },
      data: { completedAt: new Date(), metadata: this.json(body.metadata) },
    });
  }

  private async ensureItems(tenantId: string) {
    const existing = await this.prisma.onboardingItem.findMany({ where: { tenantId }, select: { key: true } });
    const keys = new Set(existing.map((item) => item.key));
    const missing = checklist.filter(([key]) => !keys.has(key));
    if (missing.length) {
      await this.prisma.onboardingItem.createMany({
        data: missing.map(([key, label]) => ({ tenantId, key, label })),
        skipDuplicates: true,
      });
    }
  }

  private json(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    return value as Prisma.InputJsonValue;
  }
}
