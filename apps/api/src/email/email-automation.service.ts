import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AutomationStatus, AutomationTriggerType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../providers/services/jobs.service';

@Injectable()
export class EmailAutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
  ) {}

  async listAutomations(tenantId: string) {
    return this.prisma.emailAutomation.findMany({
      where: { tenantId },
      include: { steps: { orderBy: { stepOrder: 'asc' } }, _count: { select: { executions: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAutomation(tenantId: string, automationId: string) {
    const automation = await this.prisma.emailAutomation.findFirst({
      where: { tenantId, id: automationId },
      include: { steps: { orderBy: { stepOrder: 'asc' } }, executions: { take: 50, orderBy: { enrolledAt: 'desc' } } },
    });
    if (!automation) throw new NotFoundException('Automation not found');
    return automation;
  }

  async createAutomation(tenantId: string, userId: string, body: Record<string, unknown>) {
    const name = body.name as string;
    if (!name?.trim()) throw new BadRequestException('Automation name is required');
    return this.prisma.emailAutomation.create({
      data: {
        tenantId,
        name: name.trim(),
        description: (body.description as string) || undefined,
        trigger: (body.trigger as AutomationTriggerType) || AutomationTriggerType.manual,
        triggerConfig: body.triggerConfig as any ?? undefined,
        createdBy: userId,
      },
      include: { steps: true },
    });
  }

  async updateAutomation(tenantId: string, automationId: string, body: Record<string, unknown>) {
    await this.ensureAutomation(tenantId, automationId);
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.trigger !== undefined) data.trigger = body.trigger;
    if (body.triggerConfig !== undefined) data.triggerConfig = body.triggerConfig;
    return this.prisma.emailAutomation.update({
      where: { id: automationId },
      data,
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
  }

  async deleteAutomation(tenantId: string, automationId: string) {
    await this.ensureAutomation(tenantId, automationId);
    await this.prisma.emailAutomation.delete({ where: { id: automationId } });
    return { success: true };
  }

  async activateAutomation(tenantId: string, automationId: string) {
    const automation = await this.ensureAutomation(tenantId, automationId);
    const steps = await this.prisma.automationStep.findMany({ where: { automationId } });
    if (steps.length === 0) throw new BadRequestException('Automation must have at least one step');
    const hasEmail = steps.some(s => s.type === 'send_email');
    if (!hasEmail) throw new BadRequestException('Automation must include at least one email step');
    return this.prisma.emailAutomation.update({
      where: { id: automationId },
      data: { status: AutomationStatus.active },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
  }

  async pauseAutomation(tenantId: string, automationId: string) {
    await this.ensureAutomation(tenantId, automationId);
    return this.prisma.emailAutomation.update({
      where: { id: automationId },
      data: { status: AutomationStatus.paused },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
  }

  async addStep(tenantId: string, automationId: string, body: Record<string, unknown>) {
    await this.ensureAutomation(tenantId, automationId);
    const maxOrder = await this.prisma.automationStep.aggregate({
      where: { automationId },
      _max: { stepOrder: true },
    });
    return this.prisma.automationStep.create({
      data: {
        automationId,
        stepOrder: (maxOrder._max.stepOrder ?? 0) + 1,
        type: body.type as any,
        name: (body.name as string) || undefined,
        config: body.config as any ?? {},
      },
    });
  }

  async updateStep(tenantId: string, automationId: string, stepId: string, body: Record<string, unknown>) {
    await this.ensureAutomation(tenantId, automationId);
    const step = await this.prisma.automationStep.findFirst({ where: { id: stepId, automationId } });
    if (!step) throw new NotFoundException('Step not found');
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.type !== undefined) data.type = body.type;
    if (body.config !== undefined) data.config = body.config;
    if (body.stepOrder !== undefined) data.stepOrder = body.stepOrder;
    return this.prisma.automationStep.update({ where: { id: stepId }, data });
  }

  async deleteStep(tenantId: string, automationId: string, stepId: string) {
    await this.ensureAutomation(tenantId, automationId);
    await this.prisma.automationStep.delete({ where: { id: stepId } });
    return { success: true };
  }

  async enrollContact(tenantId: string, automationId: string, contactId: string, email: string) {
    const automation = await this.ensureAutomation(tenantId, automationId);
    if (automation.status !== AutomationStatus.active) throw new BadRequestException('Automation is not active');
    const firstStep = await this.prisma.automationStep.findFirst({
      where: { automationId },
      orderBy: { stepOrder: 'asc' },
    });
    if (!firstStep) throw new BadRequestException('Automation has no steps');
    const execution = await this.prisma.automationExecution.upsert({
      where: { automationId_contactId: { automationId, contactId } },
      create: {
        automationId,
        contactId,
        contactEmail: email,
        currentStepId: firstStep.id,
        status: 'active',
        nextRunAt: new Date(),
      },
      update: {},
    });
    await this.prisma.emailAutomation.update({ where: { id: automationId }, data: { enrolledCount: { increment: 1 } } });
    if (process.env.REDIS_URL) {
      await this.jobs.enqueue({ tenantId, queue: 'email-automations', name: 'automation.tick', payload: { executionId: execution.id } });
    }
    return execution;
  }

  async bulkEnroll(tenantId: string, automationId: string, body: { contactIds?: string[]; segmentId?: string }) {
    const automation = await this.ensureAutomation(tenantId, automationId);
    if (automation.status !== AutomationStatus.active) throw new BadRequestException('Automation is not active');
    let contacts: Array<{ id: string; email: string }>;
    if (body.segmentId) {
      const segment = await this.prisma.emailSegment.findFirst({ where: { tenantId, id: body.segmentId } });
      if (!segment) throw new NotFoundException('Segment not found');
      contacts = await this.prisma.contact.findMany({
        where: { tenantId, marketingConsent: true },
        select: { id: true, email: true },
        take: 5000,
      });
    } else if (body.contactIds?.length) {
      contacts = await this.prisma.contact.findMany({
        where: { tenantId, id: { in: body.contactIds }, marketingConsent: true },
        select: { id: true, email: true },
      });
    } else {
      throw new BadRequestException('Provide contactIds or segmentId');
    }
    let enrolled = 0;
    for (const contact of contacts) {
      try {
        await this.enrollContact(tenantId, automationId, contact.id, contact.email);
        enrolled++;
      } catch { /* skip already enrolled */ }
    }
    return { enrolled, total: contacts.length };
  }

  async listSegments(tenantId: string) {
    return this.prisma.emailSegment.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  }

  async createSegment(tenantId: string, userId: string, body: Record<string, unknown>) {
    const name = body.name as string;
    if (!name?.trim()) throw new BadRequestException('Segment name is required');
    const filterRules = body.filterRules as any ?? {};
    const count = await this.countSegmentContacts(tenantId, filterRules);
    return this.prisma.emailSegment.create({
      data: { tenantId, name: name.trim(), description: (body.description as string) || undefined, filterRules, contactCount: count, createdBy: userId },
    });
  }

  async updateSegment(tenantId: string, segmentId: string, body: Record<string, unknown>) {
    const segment = await this.prisma.emailSegment.findFirst({ where: { tenantId, id: segmentId } });
    if (!segment) throw new NotFoundException('Segment not found');
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.filterRules !== undefined) {
      data.filterRules = body.filterRules;
      data.contactCount = await this.countSegmentContacts(tenantId, body.filterRules as any);
    }
    return this.prisma.emailSegment.update({ where: { id: segmentId }, data });
  }

  async deleteSegment(tenantId: string, segmentId: string) {
    const segment = await this.prisma.emailSegment.findFirst({ where: { tenantId, id: segmentId } });
    if (!segment) throw new NotFoundException('Segment not found');
    await this.prisma.emailSegment.delete({ where: { id: segmentId } });
    return { success: true };
  }

  async previewSegment(tenantId: string, segmentId: string) {
    const segment = await this.prisma.emailSegment.findFirst({ where: { tenantId, id: segmentId } });
    if (!segment) throw new NotFoundException('Segment not found');
    const contacts = await this.prisma.contact.findMany({
      where: { tenantId, marketingConsent: true },
      select: { id: true, email: true, firstName: true, lastName: true, status: true },
      take: 100,
    });
    return { total: contacts.length, contacts };
  }

  private async countSegmentContacts(tenantId: string, _filterRules: any) {
    return this.prisma.contact.count({ where: { tenantId, marketingConsent: true } });
  }

  private async ensureAutomation(tenantId: string, automationId: string) {
    const automation = await this.prisma.emailAutomation.findFirst({ where: { tenantId, id: automationId } });
    if (!automation) throw new NotFoundException('Automation not found');
    return automation;
  }
}
