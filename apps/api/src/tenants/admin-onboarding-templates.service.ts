import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminOnboardingTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.onboardingTemplate.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(data: { name: string; description?: string; items: unknown[]; isDefault?: boolean }) {
    return this.prisma.onboardingTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        items: data.items as Prisma.InputJsonValue,
        isDefault: data.isDefault ?? false,
      },
    });
  }

  async update(id: string, data: { name?: string; description?: string; items?: unknown[]; isDefault?: boolean }) {
    await this.ensure(id);
    return this.prisma.onboardingTemplate.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        items: data.items ? (data.items as Prisma.InputJsonValue) : undefined,
        isDefault: data.isDefault,
      },
    });
  }

  async remove(id: string) {
    await this.ensure(id);
    await this.prisma.onboardingTemplate.delete({ where: { id } });
    return { success: true };
  }

  async applyTemplate(tenantId: string, templateId: string, actorUserId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const template = await this.ensure(templateId);
    const items = (template.items as Array<{ key: string; label: string }>) ?? [];

    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.onboardingItem.upsert({
          where: { tenantId_key: { tenantId, key: item.key } },
          create: { tenantId, key: item.key, label: item.label },
          update: { label: item.label },
        });
      }
      await tx.auditLog.create({
        data: { actorUserId, tenantId, event: 'tenant.onboarding.template_applied', metadata: { templateId, templateName: template.name } as Prisma.InputJsonValue },
      });
    });

    return { success: true, itemsApplied: items.length };
  }

  private async ensure(id: string) {
    const t = await this.prisma.onboardingTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Onboarding template not found');
    return t;
  }
}
