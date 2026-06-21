import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const VALID_STYLES = ['modern', 'classic', 'minimal'];

@Injectable()
export class ProposalTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async listTenant(tenantId: string) {
    return this.prisma.proposalTemplate.findMany({
      where: { tenantId, scope: 'client' },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async listAdmin() {
    return this.prisma.proposalTemplate.findMany({
      where: { scope: 'mcc' },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getTenant(tenantId: string, id: string) {
    const template = await this.prisma.proposalTemplate.findFirst({ where: { id, tenantId, scope: 'client' } });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async getAdmin(id: string) {
    const template = await this.prisma.proposalTemplate.findFirst({ where: { id, scope: 'mcc' } });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async createTenant(tenantId: string, actorUserId: string, body: Record<string, unknown>) {
    const data = this.parseBody(body);
    if (data.isDefault) {
      await this.prisma.proposalTemplate.updateMany({ where: { tenantId, scope: 'client', isDefault: true }, data: { isDefault: false } });
    }
    return this.prisma.proposalTemplate.create({
      data: { ...data, scope: 'client', tenantId, createdBy: actorUserId },
    });
  }

  async createAdmin(actorUserId: string, body: Record<string, unknown>) {
    const data = this.parseBody(body);
    if (data.isDefault) {
      await this.prisma.proposalTemplate.updateMany({ where: { scope: 'mcc', isDefault: true }, data: { isDefault: false } });
    }
    return this.prisma.proposalTemplate.create({
      data: { ...data, scope: 'mcc', createdBy: actorUserId },
    });
  }

  async updateTenant(tenantId: string, id: string, body: Record<string, unknown>) {
    await this.getTenant(tenantId, id);
    const data = this.parseBodyPartial(body);
    if (data.isDefault) {
      await this.prisma.proposalTemplate.updateMany({ where: { tenantId, scope: 'client', isDefault: true, id: { not: id } }, data: { isDefault: false } });
    }
    return this.prisma.proposalTemplate.update({ where: { id }, data });
  }

  async updateAdmin(id: string, body: Record<string, unknown>) {
    await this.getAdmin(id);
    const data = this.parseBodyPartial(body);
    if (data.isDefault) {
      await this.prisma.proposalTemplate.updateMany({ where: { scope: 'mcc', isDefault: true, id: { not: id } }, data: { isDefault: false } });
    }
    return this.prisma.proposalTemplate.update({ where: { id }, data });
  }

  async removeTenant(tenantId: string, id: string) {
    await this.getTenant(tenantId, id);
    await this.prisma.proposalTemplate.delete({ where: { id } });
    return { success: true };
  }

  async removeAdmin(id: string) {
    await this.getAdmin(id);
    await this.prisma.proposalTemplate.delete({ where: { id } });
    return { success: true };
  }

  private parseBody(body: Record<string, unknown>) {
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : undefined;
    if (!name) throw new BadRequestException('name is required');
    const style = typeof body.style === 'string' && VALID_STYLES.includes(body.style) ? body.style : 'modern';
    return {
      name,
      description: typeof body.description === 'string' && body.description.trim() ? body.description.trim() : undefined,
      style,
      aboutUsContent: typeof body.aboutUsContent === 'string' ? body.aboutUsContent.trim() || null : undefined,
      termsItems: this.validateTermsItems(body.termsItems),
      timelineSteps: this.validateTimelineSteps(body.timelineSteps),
      isDefault: body.isDefault === true,
    };
  }

  private parseBodyPartial(body: Record<string, unknown>) {
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : undefined;
      if (!name) throw new BadRequestException('name cannot be empty');
      data.name = name;
    }
    if (body.description !== undefined) data.description = typeof body.description === 'string' ? body.description.trim() || null : null;
    if (body.style !== undefined) data.style = typeof body.style === 'string' && VALID_STYLES.includes(body.style) ? body.style : 'modern';
    if (body.aboutUsContent !== undefined) data.aboutUsContent = typeof body.aboutUsContent === 'string' ? body.aboutUsContent.trim() || null : null;
    if (body.termsItems !== undefined) data.termsItems = this.validateTermsItems(body.termsItems);
    if (body.timelineSteps !== undefined) data.timelineSteps = this.validateTimelineSteps(body.timelineSteps);
    if (body.isDefault !== undefined) data.isDefault = body.isDefault === true;
    return data;
  }

  private validateTermsItems(value: unknown): Array<{ title: string; text: string }> {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is { title: string; text: string } =>
      typeof item === 'object' && item !== null && typeof (item as any).title === 'string' && typeof (item as any).text === 'string'
    ).map((item) => ({ title: item.title.trim(), text: item.text.trim() }));
  }

  private validateTimelineSteps(value: unknown): Array<{ title: string; description: string }> {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is { title: string; description: string } =>
      typeof item === 'object' && item !== null && typeof (item as any).title === 'string' && typeof (item as any).description === 'string'
    ).map((item) => ({ title: item.title.trim(), description: item.description.trim() }));
  }
}
