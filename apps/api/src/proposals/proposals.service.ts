import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PlanKey, Prisma, TenantStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalNumberService } from './proposal-number.service';
import { BrandingService } from './branding.service';
import { ProposalActivityService } from './proposal-activity.service';

@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbers: ProposalNumberService,
    private readonly branding: BrandingService,
    private readonly activity: ProposalActivityService,
  ) {}

  // ── List ────────────────────────────────────────────────────────────────

  async listTenant(tenantId: string, query: Record<string, string>) {
    const where: Prisma.ProposalWhereInput = { tenantId };
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { recipientName: { contains: query.search, mode: 'insensitive' } },
        { companyName: { contains: query.search, mode: 'insensitive' } },
        { proposalNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const { skip, take } = this.page(query);
    const [items, total] = await Promise.all([
      this.prisma.proposal.findMany({
        where,
        include: { services: { orderBy: { sortOrder: 'asc' } }, lineItems: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.proposal.count({ where }),
    ]);

    return { items: items.map((p) => this.stripPrivateFields(p)), total, page: Math.floor(skip / take) + 1, pageSize: take };
  }

  async listAdmin(query: Record<string, string>) {
    const where: Prisma.ProposalWhereInput = { scope: 'mcc' };
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { recipientName: { contains: query.search, mode: 'insensitive' } },
        { proposalNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const { skip, take } = this.page(query);
    const [items, total] = await Promise.all([
      this.prisma.proposal.findMany({
        where,
        include: {
          services: { orderBy: { sortOrder: 'asc' } },
          lineItems: true,
          tenant: { select: { id: true, companyName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.proposal.count({ where }),
    ]);

    return { items, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }

  // ── Get ─────────────────────────────────────────────────────────────────

  async getTenant(tenantId: string, id: string) {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id, tenantId },
      include: {
        services: { orderBy: { sortOrder: 'asc' } },
        sections: { orderBy: { sortOrder: 'asc' } },
        lineItems: true,
        activities: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!proposal) throw new NotFoundException('Proposal not found');
    return proposal;
  }

  async getAdmin(id: string) {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id, scope: 'mcc' },
      include: {
        services: { orderBy: { sortOrder: 'asc' } },
        sections: { orderBy: { sortOrder: 'asc' } },
        lineItems: true,
        activities: { orderBy: { createdAt: 'desc' }, take: 50 },
        tenant: { select: { id: true, companyName: true, email: true } },
      },
    });
    if (!proposal) throw new NotFoundException('Proposal not found');
    return proposal;
  }

  async getByToken(token: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { trackingToken: token },
      include: { services: { orderBy: { sortOrder: 'asc' } }, sections: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!proposal) throw new NotFoundException('Proposal not found');
    return this.stripPrivateFields(proposal);
  }

  // ── Create ──────────────────────────────────────────────────────────────

  async createTenant(tenantId: string, actorUserId: string, body: Record<string, unknown>) {
    const prefix = await this.numbers.resolvePrefix(tenantId);
    const proposalNumber = await this.numbers.generate('client', tenantId, prefix);
    const brandSnapshot = await this.branding.resolve('client', tenantId);

    const proposal = await this.buildAndCreate({
      scope: 'client',
      createdByType: 'client',
      recipientType: 'customer',
      tenantId,
      proposalNumber,
      brandSnapshot,
      actorUserId,
      body,
    });

    await this.activity.log({ proposalId: proposal.id, eventType: 'created', actorType: 'client', actorId: actorUserId });
    return proposal;
  }

  async createAdmin(actorUserId: string, body: Record<string, unknown>) {
    const proposalNumber = await this.numbers.generate('mcc');
    const brandSnapshot = await this.branding.resolve('mcc_admin');
    const tenantId = this.optionalString(body.tenantId);

    const proposal = await this.buildAndCreate({
      scope: 'mcc',
      createdByType: 'mcc_admin',
      recipientType: 'client',
      tenantId,
      proposalNumber,
      brandSnapshot,
      actorUserId,
      body,
    });

    await this.activity.log({ proposalId: proposal.id, eventType: 'created', actorType: 'admin', actorId: actorUserId });
    return proposal;
  }

  // ── Update ──────────────────────────────────────────────────────────────

  async updateTenant(tenantId: string, id: string, body: Record<string, unknown>) {
    await this.getTenant(tenantId, id);
    return this.updateProposal(id, body);
  }

  async updateAdmin(id: string, body: Record<string, unknown>) {
    await this.getAdmin(id);
    return this.updateProposal(id, body);
  }

  // ── Delete ──────────────────────────────────────────────────────────────

  async removeTenant(tenantId: string, id: string) {
    await this.getTenant(tenantId, id);
    await this.prisma.proposal.delete({ where: { id } });
    return { success: true };
  }

  async removeAdmin(id: string) {
    await this.getAdmin(id);
    await this.prisma.proposal.delete({ where: { id } });
    return { success: true };
  }

  // ── Duplicate ───────────────────────────────────────────────────────────

  async duplicateTenant(tenantId: string, id: string, actorUserId: string) {
    const original = await this.getTenant(tenantId, id);
    const prefix = await this.numbers.resolvePrefix(tenantId);
    const proposalNumber = await this.numbers.generate('client', tenantId, prefix);

    return this.duplicateProposal(original, proposalNumber, actorUserId);
  }

  async duplicateAdmin(id: string, actorUserId: string) {
    const original = await this.getAdmin(id);
    const proposalNumber = await this.numbers.generate('mcc');
    return this.duplicateProposal(original, proposalNumber, actorUserId);
  }

  // ── Status ──────────────────────────────────────────────────────────────

  async updateStatus(id: string, status: string) {
    const validStatuses = ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'];
    if (!validStatuses.includes(status)) throw new BadRequestException('Invalid status');

    const data: Prisma.ProposalUpdateInput = { status };
    if (status === 'sent') data.sentAt = new Date();
    if (status === 'viewed') data.viewedAt = new Date();
    if (status === 'accepted') data.acceptedAt = new Date();
    if (status === 'rejected') data.rejectedAt = new Date();

    return this.prisma.proposal.update({ where: { id }, data });
  }

  // ── Track & Public Actions ──────────────────────────────────────────────

  async trackView(token: string, metadata?: Record<string, unknown>) {
    const proposal = await this.prisma.proposal.findUnique({ where: { trackingToken: token } });
    if (!proposal) throw new NotFoundException('Proposal not found');

    if (proposal.status === 'sent') {
      await this.prisma.proposal.update({ where: { id: proposal.id }, data: { status: 'viewed', viewedAt: new Date() } });
    }

    await this.activity.log({
      proposalId: proposal.id,
      eventType: 'viewed',
      actorType: 'customer',
      metadata,
    });

    return this.getByToken(token);
  }

  async acceptByToken(token: string, signatureData?: Record<string, unknown>) {
    const proposal = await this.prisma.proposal.findUnique({ where: { trackingToken: token } });
    if (!proposal) throw new NotFoundException('Proposal not found');

    await this.prisma.proposal.update({
      where: { id: proposal.id },
      data: { status: 'accepted', acceptedAt: new Date(), signatureData: signatureData ? (signatureData as Prisma.InputJsonValue) : undefined },
    });

    await this.activity.log({ proposalId: proposal.id, eventType: 'accepted', actorType: 'customer' });
    return { success: true };
  }

  async rejectByToken(token: string, reason?: string) {
    const proposal = await this.prisma.proposal.findUnique({ where: { trackingToken: token } });
    if (!proposal) throw new NotFoundException('Proposal not found');

    await this.prisma.proposal.update({
      where: { id: proposal.id },
      data: { status: 'rejected', rejectedAt: new Date() },
    });

    await this.activity.log({ proposalId: proposal.id, eventType: 'rejected', actorType: 'customer', metadata: reason ? { reason } as Record<string, unknown> : undefined });
    return { success: true };
  }

  // ── Convert Admin Proposal ──────────────────────────────────────────────

  async convertAdminProposalToClient(id: string, actorUserId: string) {
    const proposal = await this.getAdmin(id);
    if (proposal.tenantId) return { tenantId: proposal.tenantId };

    const tenant = await this.prisma.tenant.create({
      data: {
        companyName: proposal.companyName || proposal.recipientName,
        contactName: proposal.recipientName,
        email: proposal.recipientEmail || `client-${Date.now()}@example.local`,
        plan: PlanKey.starter,
        status: TenantStatus.trial,
        seats: 1,
        mrr: 0,
        notes: `Created from proposal ${proposal.title}`,
        enabledServices: { create: [{ key: 'crm' }] },
      },
    });

    await this.prisma.proposal.update({
      where: { id },
      data: { tenantId: tenant.id, status: 'accepted', acceptedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: { actorUserId, tenantId: tenant.id, event: 'proposal.converted_to_client', metadata: { proposalId: id } },
    });

    return { tenantId: tenant.id };
  }

  // ── Analytics (Admin) ───────────────────────────────────────────────────

  async getAdminAnalytics() {
    const proposals = await this.prisma.proposal.findMany({
      where: { scope: 'mcc' },
      select: { status: true, total: true, createdAt: true, services: { select: { serviceType: true, finalPrice: true } } },
    });

    const total = proposals.length;
    const accepted = proposals.filter((p) => p.status === 'accepted').length;
    const rejected = proposals.filter((p) => p.status === 'rejected').length;
    const winRate = total > 0 ? Math.round((accepted / total) * 100) : 0;
    const totalRevenue = proposals.filter((p) => p.status === 'accepted').reduce((sum, p) => sum + Number(p.total), 0);
    const avgDealValue = accepted > 0 ? totalRevenue / accepted : 0;

    const byStatus: Record<string, number> = {};
    proposals.forEach((p) => { byStatus[p.status] = (byStatus[p.status] ?? 0) + 1; });

    const byService: Record<string, number> = {};
    proposals.filter((p) => p.status === 'accepted').forEach((p) => {
      p.services.forEach((s) => { byService[s.serviceType] = (byService[s.serviceType] ?? 0) + Number(s.finalPrice); });
    });

    const byMonth: Record<string, number> = {};
    proposals.forEach((p) => {
      const key = `${p.createdAt.getFullYear()}-${String(p.createdAt.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] ?? 0) + 1;
    });

    return { total, accepted, rejected, winRate, totalRevenue, avgDealValue, byStatus, byService, byMonth };
  }

  async getAdminStats() {
    const [total, draft, sent, viewed, accepted, rejected] = await Promise.all([
      this.prisma.proposal.count({ where: { scope: 'mcc' } }),
      this.prisma.proposal.count({ where: { scope: 'mcc', status: 'draft' } }),
      this.prisma.proposal.count({ where: { scope: 'mcc', status: 'sent' } }),
      this.prisma.proposal.count({ where: { scope: 'mcc', status: 'viewed' } }),
      this.prisma.proposal.count({ where: { scope: 'mcc', status: 'accepted' } }),
      this.prisma.proposal.count({ where: { scope: 'mcc', status: 'rejected' } }),
    ]);
    return { total, draft, sent, viewed, accepted, rejected };
  }

  // ── Profit Summary (Client) ─────────────────────────────────────────────

  async getProfitSummary(tenantId: string) {
    const proposals = await this.prisma.proposal.findMany({
      where: { tenantId, status: 'accepted' },
      select: { total: true, mccCostAmount: true, creatorProfitAmount: true },
    });

    const totalRevenue = proposals.reduce((sum, p) => sum + Number(p.total), 0);
    const totalCost = proposals.reduce((sum, p) => sum + Number(p.mccCostAmount), 0);
    const totalProfit = proposals.reduce((sum, p) => sum + Number(p.creatorProfitAmount), 0);
    const avgMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

    return { totalRevenue, totalCost, totalProfit, avgMargin, proposalCount: proposals.length };
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private async buildAndCreate(params: {
    scope: string;
    createdByType: string;
    recipientType: string;
    tenantId?: string;
    proposalNumber: string;
    brandSnapshot: unknown;
    actorUserId: string;
    body: Record<string, unknown>;
  }) {
    const { scope, createdByType, recipientType, tenantId, proposalNumber, brandSnapshot, actorUserId, body } = params;

    const lineItems = this.parseLineItems(body.lineItems);
    const services = this.parseServices(body.services);
    const sections = this.parseSections(body.sections);

    const serviceSubtotal = services.reduce((sum, s) => sum + Number(s.finalPrice), 0);
    const lineItemSubtotal = lineItems.reduce((sum, li) => sum + Number(li.total), 0);
    const rawSubtotal = serviceSubtotal + lineItemSubtotal;

    const totals = this.calculateTotals(rawSubtotal, body.discountType, body.discountValue, body.setupFee);
    const mccCost = services.reduce((sum, s) => sum + Number(s.mccBaseCost), 0);
    const profit = totals.total - mccCost;

    return this.prisma.proposal.create({
      data: {
        scope,
        createdByType,
        recipientType,
        tenantId,
        proposalNumber,
        title: this.requiredString(body.title, 'title'),
        recipientName: this.requiredString(body.recipientName, 'recipientName'),
        recipientEmail: this.optionalString(body.recipientEmail),
        companyName: this.optionalString(body.companyName),
        contactId: this.optionalString(body.contactId),
        companyId: this.optionalString(body.companyId),
        dealId: this.optionalString(body.dealId),
        status: this.optionalString(body.status) ?? 'draft',
        billingCycle: this.optionalString(body.billingCycle) ?? 'monthly',
        contractDuration: this.optionalString(body.contractDuration),
        paymentTerms: this.optionalString(body.paymentTerms),
        setupFee: totals.setupFee,
        subtotal: totals.subtotal,
        discountType: totals.discountType,
        discountValue: totals.discountValue,
        discountAmount: totals.discountAmount,
        total: totals.total,
        mccCostAmount: mccCost,
        creatorProfitAmount: Math.max(0, profit),
        validUntil: this.optionalDate(body.validUntil),
        customIntroMessage: this.optionalString(body.customIntroMessage),
        templateId: this.optionalString(body.templateId) ?? 'modern',
        brandingSnapshot: brandSnapshot as any,
        notes: this.optionalString(body.notes),
        createdBy: actorUserId,
        lineItems: lineItems.length > 0 ? { create: lineItems } : undefined,
        services: services.length > 0 ? { create: services } : undefined,
        sections: sections.length > 0 ? { create: sections } : undefined,
      },
      include: { services: true, sections: true, lineItems: true },
    });
  }

  private async updateProposal(id: string, body: Record<string, unknown>) {
    const data: Prisma.ProposalUpdateInput = {};

    if (body.title !== undefined) data.title = this.optionalString(body.title);
    if (body.recipientName !== undefined) data.recipientName = this.optionalString(body.recipientName);
    if (body.recipientEmail !== undefined) data.recipientEmail = this.optionalString(body.recipientEmail);
    if (body.companyName !== undefined) data.companyName = this.optionalString(body.companyName);
    if (body.status !== undefined) data.status = this.optionalString(body.status);
    if (body.billingCycle !== undefined) data.billingCycle = this.optionalString(body.billingCycle);
    if (body.contractDuration !== undefined) data.contractDuration = this.optionalString(body.contractDuration);
    if (body.paymentTerms !== undefined) data.paymentTerms = this.optionalString(body.paymentTerms);
    if (body.customIntroMessage !== undefined) data.customIntroMessage = this.optionalString(body.customIntroMessage);
    if (body.templateId !== undefined) data.templateId = this.optionalString(body.templateId) ?? 'modern';
    if (body.validUntil !== undefined) data.validUntil = this.optionalDate(body.validUntil);
    if (body.notes !== undefined) data.notes = this.optionalString(body.notes);

    if (body.status === 'sent') data.sentAt = new Date();
    if (body.status === 'accepted') data.acceptedAt = new Date();
    if (body.status === 'rejected') data.rejectedAt = new Date();

    const services = Array.isArray(body.services) ? this.parseServices(body.services) : undefined;
    const lineItems = Array.isArray(body.lineItems) ? this.parseLineItems(body.lineItems) : undefined;
    const sections = Array.isArray(body.sections) ? this.parseSections(body.sections) : undefined;

    if (services || lineItems) {
      const serviceSubtotal = services ? services.reduce((sum, s) => sum + Number(s.finalPrice), 0) : 0;
      const lineItemSubtotal = lineItems ? lineItems.reduce((sum, li) => sum + Number(li.total), 0) : 0;
      const rawSubtotal = serviceSubtotal + lineItemSubtotal;
      const totals = this.calculateTotals(rawSubtotal, body.discountType, body.discountValue, body.setupFee);
      const mccCost = services ? services.reduce((sum, s) => sum + Number(s.mccBaseCost), 0) : 0;

      Object.assign(data, {
        setupFee: totals.setupFee,
        subtotal: totals.subtotal,
        discountType: totals.discountType,
        discountValue: totals.discountValue,
        discountAmount: totals.discountAmount,
        total: totals.total,
        mccCostAmount: mccCost,
        creatorProfitAmount: Math.max(0, totals.total - mccCost),
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.proposal.update({ where: { id }, data });

      if (services) {
        await tx.proposalService.deleteMany({ where: { proposalId: id } });
        if (services.length > 0) {
          await tx.proposalService.createMany({ data: services.map((s) => ({ ...s, proposalId: id })) });
        }
      }

      if (lineItems) {
        await tx.proposalLineItem.deleteMany({ where: { proposalId: id } });
        if (lineItems.length > 0) {
          await tx.proposalLineItem.createMany({ data: lineItems.map((li) => ({ ...li, proposalId: id })) });
        }
      }

      if (sections) {
        await tx.proposalSection.deleteMany({ where: { proposalId: id } });
        if (sections.length > 0) {
          await tx.proposalSection.createMany({ data: sections.map((s) => ({ ...s, proposalId: id })) });
        }
      }
    });

    return this.prisma.proposal.findUnique({
      where: { id },
      include: { services: { orderBy: { sortOrder: 'asc' } }, sections: { orderBy: { sortOrder: 'asc' } }, lineItems: true },
    });
  }

  private async duplicateProposal(original: any, proposalNumber: string, actorUserId: string) {
    return this.prisma.proposal.create({
      data: {
        scope: original.scope,
        createdByType: original.createdByType,
        recipientType: original.recipientType,
        tenantId: original.tenantId,
        proposalNumber,
        title: `${original.title} (Copy)`,
        recipientName: original.recipientName,
        recipientEmail: original.recipientEmail,
        companyName: original.companyName,
        status: 'draft',
        billingCycle: original.billingCycle,
        contractDuration: original.contractDuration,
        paymentTerms: original.paymentTerms,
        setupFee: original.setupFee,
        subtotal: original.subtotal,
        discountType: original.discountType,
        discountValue: original.discountValue,
        discountAmount: original.discountAmount,
        total: original.total,
        mccCostAmount: original.mccCostAmount,
        creatorProfitAmount: original.creatorProfitAmount,
        customIntroMessage: original.customIntroMessage,
        brandingSnapshot: original.brandingSnapshot,
        notes: original.notes,
        createdBy: actorUserId,
        services: original.services?.length > 0 ? {
          create: original.services.map((s: any) => ({
            serviceType: s.serviceType,
            planName: s.planName,
            listPrice: s.listPrice,
            discountPercentage: s.discountPercentage,
            finalPrice: s.finalPrice,
            mccBaseCost: s.mccBaseCost,
            creatorMargin: s.creatorMargin,
            features: s.features,
            customDescription: s.customDescription,
            sortOrder: s.sortOrder,
          })),
        } : undefined,
        sections: original.sections?.length > 0 ? {
          create: original.sections.map((s: any) => ({
            sectionKey: s.sectionKey,
            sectionTitle: s.sectionTitle,
            content: s.content,
            isEnabled: s.isEnabled,
            sortOrder: s.sortOrder,
          })),
        } : undefined,
        lineItems: original.lineItems?.length > 0 ? {
          create: original.lineItems.map((li: any) => ({
            name: li.name,
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            total: li.total,
          })),
        } : undefined,
      },
      include: { services: true, sections: true, lineItems: true },
    });
  }

  private parseServices(value: unknown) {
    if (!Array.isArray(value) || value.length === 0) return [];
    return value.map((raw, index) => {
      const item = raw as Record<string, unknown>;
      const listPrice = this.optionalNumber(item.listPrice, 0) ?? 0;
      const discountPercentage = Math.min(Math.max(this.optionalNumber(item.discountPercentage, 0) ?? 0, 0), 100);
      const finalPrice = listPrice * (1 - discountPercentage / 100);
      const mccBaseCost = this.optionalNumber(item.mccBaseCost, 0) ?? 0;

      return {
        serviceType: this.requiredString(item.serviceType, 'serviceType'),
        planName: this.requiredString(item.planName, 'planName'),
        listPrice,
        discountPercentage,
        finalPrice: Math.round(finalPrice * 100) / 100,
        mccBaseCost,
        creatorMargin: Math.round((finalPrice - mccBaseCost) * 100) / 100,
        features: Array.isArray(item.features) ? item.features : [],
        customDescription: this.optionalString(item.customDescription),
        sortOrder: index,
      };
    });
  }

  private parseSections(value: unknown) {
    if (!Array.isArray(value) || value.length === 0) return [];
    return value.map((raw, index) => {
      const item = raw as Record<string, unknown>;
      return {
        sectionKey: this.requiredString(item.sectionKey, 'sectionKey'),
        sectionTitle: this.requiredString(item.sectionTitle, 'sectionTitle'),
        content: (item.content ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        isEnabled: typeof item.isEnabled === 'boolean' ? item.isEnabled : true,
        sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : index,
      };
    });
  }

  private parseLineItems(value: unknown) {
    if (!Array.isArray(value) || value.length === 0) return [];
    return value.map((raw) => {
      const item = raw as Record<string, unknown>;
      const quantity = Math.max(this.optionalNumber(item.quantity, 1) ?? 1, 1);
      const unitPrice = this.optionalNumber(item.unitPrice, 0) ?? 0;
      return {
        name: this.requiredString(item.name, 'line item name'),
        description: this.optionalString(item.description),
        quantity,
        unitPrice,
        total: quantity * unitPrice,
      };
    });
  }

  private calculateTotals(subtotal: number, discountTypeValue: unknown, discountValueRaw: unknown, setupFeeRaw: unknown) {
    const discountType = this.optionalString(discountTypeValue) ?? 'none';
    const discountValue = this.optionalNumber(discountValueRaw, 0) ?? 0;
    const setupFee = this.optionalNumber(setupFeeRaw, 0) ?? 0;

    let discountAmount = 0;
    if (discountType === 'percent') discountAmount = subtotal * Math.min(Math.max(discountValue, 0), 100) / 100;
    if (discountType === 'fixed') discountAmount = Math.max(discountValue, 0);
    if (!['none', 'percent', 'fixed'].includes(discountType)) throw new BadRequestException('Invalid discount type');

    const total = Math.max(0, Math.round((subtotal - discountAmount + setupFee) * 100) / 100);
    return { subtotal, discountType, discountValue, discountAmount: Math.round(discountAmount * 100) / 100, setupFee, total };
  }

  private stripPrivateFields(proposal: any) {
    const { mccCostAmount, creatorProfitAmount, ...rest } = proposal;
    if (rest.services) {
      rest.services = rest.services.map((s: any) => {
        const { mccBaseCost, creatorMargin, ...sRest } = s;
        return sRest;
      });
    }
    return rest;
  }

  private page(query: Record<string, string>) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 50), 1), 100);
    return { skip: (page - 1) * pageSize, take: pageSize };
  }

  private requiredString(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${field} is required`);
    return value.trim();
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private optionalNumber(value: unknown, fallback?: number) {
    if (value === undefined || value === null || value === '') return fallback;
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) throw new BadRequestException('Invalid number value');
    return numberValue;
  }

  private optionalDate(value: unknown) {
    if (typeof value !== 'string' || !value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date value');
    return date;
  }
}
