import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContactSource, ContactStatus, DealStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  listContacts(tenantId: string, query: Record<string, string>) {
    const where: Prisma.ContactWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status as ContactStatus } : {}),
      ...(query.q ? {
        OR: [
          { firstName: { contains: query.q, mode: 'insensitive' } },
          { lastName: { contains: query.q, mode: 'insensitive' } },
          { email: { contains: query.q, mode: 'insensitive' } },
        ],
      } : {}),
    };
    return this.prisma.contact.findMany({ where, orderBy: { createdAt: 'desc' }, ...this.page(query) });
  }

  createContact(tenantId: string, actorUserId: string, body: Record<string, unknown>) {
    return this.prisma.$transaction(async (tx) => {
      const contact = await tx.contact.create({
        data: {
          tenantId,
          firstName: this.requiredString(body.firstName, 'firstName'),
          lastName: this.requiredString(body.lastName, 'lastName'),
          email: this.requiredString(body.email, 'email').toLowerCase(),
          phone: this.optionalString(body.phone),
          jobTitle: this.optionalString(body.jobTitle),
          companyId: this.optionalString(body.companyId),
          assignedTo: this.optionalString(body.assignedTo),
          status: this.optionalEnum(body.status, Object.values(ContactStatus), ContactStatus.lead),
          source: this.optionalEnum(body.source, Object.values(ContactSource), ContactSource.manual),
          tags: this.stringArray(body.tags),
        },
      });
      await this.logActivity(tx, tenantId, actorUserId, 'contact_created', `Created contact ${contact.firstName} ${contact.lastName}`, { contactId: contact.id, companyId: contact.companyId });
      return contact;
    });
  }

  async getContact(tenantId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({ where: { tenantId, id } });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async updateContact(tenantId: string, actorUserId: string, id: string, body: Record<string, unknown>) {
    await this.getContact(tenantId, id);
    return this.prisma.$transaction(async (tx) => {
      const contact = await tx.contact.update({
        where: { id },
        data: {
          firstName: this.optionalString(body.firstName),
          lastName: this.optionalString(body.lastName),
          email: typeof body.email === 'string' ? body.email.toLowerCase() : undefined,
          phone: this.optionalString(body.phone),
          jobTitle: this.optionalString(body.jobTitle),
          companyId: this.optionalString(body.companyId),
          assignedTo: this.optionalString(body.assignedTo),
          status: this.optionalEnum(body.status, Object.values(ContactStatus)),
          source: this.optionalEnum(body.source, Object.values(ContactSource)),
          tags: Array.isArray(body.tags) ? this.stringArray(body.tags) : undefined,
          lastActivityAt: new Date(),
        },
      });
      await this.logActivity(tx, tenantId, actorUserId, 'contact_updated', `Updated contact ${contact.firstName} ${contact.lastName}`, { contactId: id, companyId: contact.companyId });
      return contact;
    });
  }

  async deleteContact(tenantId: string, id: string) {
    await this.getContact(tenantId, id);
    await this.prisma.contact.delete({ where: { id } });
    return { success: true };
  }

  listCompanies(tenantId: string, query: Record<string, string>) {
    const where: Prisma.CompanyWhereInput = {
      tenantId,
      ...(query.q ? { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { domain: { contains: query.q, mode: 'insensitive' } }] } : {}),
    };
    return this.prisma.company.findMany({ where, orderBy: { createdAt: 'desc' }, ...this.page(query) });
  }

  createCompany(tenantId: string, actorUserId: string, body: Record<string, unknown>) {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          tenantId,
          name: this.requiredString(body.name, 'name'),
          domain: this.optionalString(body.domain),
          industry: this.optionalString(body.industry),
          size: this.optionalString(body.size),
          website: this.optionalString(body.website),
          phone: this.optionalString(body.phone),
          assignedTo: this.optionalString(body.assignedTo),
          tags: this.stringArray(body.tags),
        },
      });
      await this.logActivity(tx, tenantId, actorUserId, 'company_created', `Created company ${company.name}`, { companyId: company.id });
      return company;
    });
  }

  async getCompany(tenantId: string, id: string) {
    const company = await this.prisma.company.findFirst({ where: { tenantId, id } });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async updateCompany(tenantId: string, actorUserId: string, id: string, body: Record<string, unknown>) {
    await this.getCompany(tenantId, id);
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.update({
        where: { id },
        data: {
          name: this.optionalString(body.name),
          domain: this.optionalString(body.domain),
          industry: this.optionalString(body.industry),
          size: this.optionalString(body.size),
          website: this.optionalString(body.website),
          phone: this.optionalString(body.phone),
          assignedTo: this.optionalString(body.assignedTo),
          tags: Array.isArray(body.tags) ? this.stringArray(body.tags) : undefined,
        },
      });
      await this.logActivity(tx, tenantId, actorUserId, 'company_updated', `Updated company ${company.name}`, { companyId: id });
      return company;
    });
  }

  async deleteCompany(tenantId: string, id: string) {
    await this.getCompany(tenantId, id);
    await this.prisma.company.delete({ where: { id } });
    return { success: true };
  }

  listDeals(tenantId: string, query: Record<string, string>) {
    const where: Prisma.DealWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status as DealStatus } : {}),
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
    };
    return this.prisma.deal.findMany({ where, orderBy: { createdAt: 'desc' }, ...this.page(query) });
  }

  createDeal(tenantId: string, actorUserId: string, body: Record<string, unknown>) {
    return this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.create({
        data: {
          tenantId,
          title: this.requiredString(body.title, 'title'),
          value: this.optionalNumber(body.value, 0) ?? 0,
          currency: this.optionalString(body.currency) ?? 'USD',
          stage: this.requiredString(body.stage, 'stage'),
          companyId: this.optionalString(body.companyId),
          assignedTo: this.requiredString(body.assignedTo, 'assignedTo'),
          status: this.optionalEnum(body.status, Object.values(DealStatus), DealStatus.open),
          probability: this.optionalNumber(body.probability, 0) ?? 0,
          expectedCloseDate: typeof body.expectedCloseDate === 'string' ? new Date(body.expectedCloseDate) : undefined,
        },
      });
      await this.logActivity(tx, tenantId, actorUserId, 'deal_created', `Created deal ${deal.title}`, { dealId: deal.id, companyId: deal.companyId });
      return deal;
    });
  }

  async getDeal(tenantId: string, id: string) {
    const deal = await this.prisma.deal.findFirst({ where: { tenantId, id } });
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  async updateDeal(tenantId: string, actorUserId: string, id: string, body: Record<string, unknown>) {
    await this.getDeal(tenantId, id);
    return this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.update({
        where: { id },
        data: {
          title: this.optionalString(body.title),
          value: this.optionalNumber(body.value),
          currency: this.optionalString(body.currency),
          stage: this.optionalString(body.stage),
          companyId: this.optionalString(body.companyId),
          assignedTo: this.optionalString(body.assignedTo),
          status: this.optionalEnum(body.status, Object.values(DealStatus)),
          probability: this.optionalNumber(body.probability),
          expectedCloseDate: typeof body.expectedCloseDate === 'string' ? new Date(body.expectedCloseDate) : undefined,
        },
      });
      await this.logActivity(tx, tenantId, actorUserId, 'deal_updated', `Updated deal ${deal.title}`, { dealId: id, companyId: deal.companyId });
      return deal;
    });
  }

  async deleteDeal(tenantId: string, id: string) {
    await this.getDeal(tenantId, id);
    await this.prisma.deal.delete({ where: { id } });
    return { success: true };
  }

  listActivities(tenantId: string, query: Record<string, string>) {
    return this.prisma.activity.findMany({
      where: {
        tenantId,
        contactId: query.contactId,
        companyId: query.companyId,
        dealId: query.dealId,
      },
      orderBy: { createdAt: 'desc' },
      ...this.page(query),
    });
  }

  createActivity(tenantId: string, actorUserId: string, body: Record<string, unknown>) {
    return this.prisma.activity.create({
      data: {
        tenantId,
        type: this.requiredString(body.type, 'type'),
        subject: this.requiredString(body.subject, 'subject'),
        body: this.optionalString(body.body),
        contactId: this.optionalString(body.contactId),
        companyId: this.optionalString(body.companyId),
        dealId: this.optionalString(body.dealId),
        createdBy: this.optionalString(body.createdBy) ?? actorUserId,
      },
    });
  }

  // Pipeline Stages

  listPipelineStages(tenantId: string) {
    return this.prisma.pipelineStage.findMany({ where: { tenantId }, orderBy: { order: 'asc' } });
  }

  createPipelineStage(tenantId: string, body: Record<string, unknown>) {
    return this.prisma.pipelineStage.create({
      data: {
        tenantId,
        name: this.requiredString(body.name, 'name'),
        order: this.optionalNumber(body.order, 0) ?? 0,
        color: this.optionalString(body.color),
      },
    });
  }

  async updatePipelineStage(tenantId: string, id: string, body: Record<string, unknown>) {
    const stage = await this.prisma.pipelineStage.findFirst({ where: { tenantId, id } });
    if (!stage) throw new NotFoundException('Pipeline stage not found');
    return this.prisma.pipelineStage.update({
      where: { id },
      data: {
        name: this.optionalString(body.name),
        order: this.optionalNumber(body.order),
        color: this.optionalString(body.color),
      },
    });
  }

  async deletePipelineStage(tenantId: string, id: string) {
    const stage = await this.prisma.pipelineStage.findFirst({ where: { tenantId, id } });
    if (!stage) throw new NotFoundException('Pipeline stage not found');
    await this.prisma.pipelineStage.delete({ where: { id } });
    return { success: true };
  }

  async reorderPipelineStages(tenantId: string, body: Record<string, unknown>) {
    const stageIds = body.stageIds;
    if (!Array.isArray(stageIds)) throw new BadRequestException('stageIds array is required');
    for (let i = 0; i < stageIds.length; i++) {
      await this.prisma.pipelineStage.updateMany({
        where: { tenantId, id: String(stageIds[i]) },
        data: { order: i },
      });
    }
    return this.listPipelineStages(tenantId);
  }

  // Tags

  listTags(tenantId: string) {
    return this.prisma.tag.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  createTag(tenantId: string, body: Record<string, unknown>) {
    return this.prisma.tag.create({
      data: {
        tenantId,
        name: this.requiredString(body.name, 'name'),
        color: this.optionalString(body.color),
      },
    });
  }

  async updateTag(tenantId: string, id: string, body: Record<string, unknown>) {
    const tag = await this.prisma.tag.findFirst({ where: { tenantId, id } });
    if (!tag) throw new NotFoundException('Tag not found');
    return this.prisma.tag.update({
      where: { id },
      data: {
        name: this.optionalString(body.name),
        color: this.optionalString(body.color),
      },
    });
  }

  async deleteTag(tenantId: string, id: string) {
    const tag = await this.prisma.tag.findFirst({ where: { tenantId, id } });
    if (!tag) throw new NotFoundException('Tag not found');
    await this.prisma.tag.delete({ where: { id } });
    return { success: true };
  }

  private logActivity(tx: Prisma.TransactionClient, tenantId: string, actorUserId: string, type: string, subject: string, links: { contactId?: string; companyId?: string | null; dealId?: string }) {
    return tx.activity.create({
      data: {
        tenantId,
        type,
        subject,
        contactId: links.contactId,
        companyId: links.companyId ?? undefined,
        dealId: links.dealId,
        createdBy: actorUserId,
      },
    });
  }

  private page(query: Record<string, string>) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 50), 1), 100);
    return { skip: (page - 1) * pageSize, take: pageSize };
  }

  private requiredString(value: unknown, field: string) {
    if (typeof value !== 'string' || value.trim().length === 0) throw new BadRequestException(`${field} is required`);
    return value.trim();
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  }

  private optionalNumber(value: unknown, fallback?: number) {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new BadRequestException('Invalid number value');
    return parsed;
  }

  private optionalEnum<T extends string>(value: unknown, allowed: T[], fallback?: T) {
    if (value === undefined || value === null || value === '') return fallback;
    if (!allowed.includes(value as T)) throw new BadRequestException('Invalid enum value');
    return value as T;
  }

  private stringArray(value: unknown) {
    return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
  }
}
