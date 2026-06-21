import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BrandingService } from '../proposals/branding.service';
import { JobsService } from '../providers/services/jobs.service';
import { FinanceActivityService } from './finance-activity.service';
import { FinanceNumberService } from './finance-number.service';

type Scope = 'mcc' | 'client';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbers: FinanceNumberService,
    private readonly activity: FinanceActivityService,
    private readonly branding: BrandingService,
    private readonly jobs: JobsService,
  ) {}

  async listInvoices(scope: Scope, tenantId: string | undefined, query: Record<string, string>) {
    const where: Prisma.FinanceInvoiceWhereInput = {
      ...this.scopeWhere(scope, tenantId),
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.recipient ? { recipientName: { contains: query.recipient, mode: 'insensitive' } } : {}),
      ...(query.tenantId && scope === 'mcc' ? { tenantId: query.tenantId } : {}),
    };
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 50), 1), 100);
    const page = Math.max(Number(query.page ?? 1), 1);
    const [items, total] = await Promise.all([
      this.prisma.financeInvoice.findMany({
        where,
        include: this.invoiceInclude(),
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.financeInvoice.count({ where }),
    ]);
    return { items: items.map((invoice) => this.serializeInvoice(invoice)), pagination: { page, pageSize, total } };
  }

  async getInvoice(scope: Scope, tenantId: string | undefined, id: string) {
    const invoice = await this.findInvoice(scope, tenantId, id);
    return this.serializeInvoice(invoice);
  }

  async publicInvoice(token: string, markViewed = false) {
    const invoice = await this.prisma.financeInvoice.findUnique({
      where: { publicToken: token },
      include: this.invoiceInclude(),
    });
    if (!invoice || invoice.deletedAt) throw new NotFoundException('Invoice not found');
    if (markViewed && !invoice.viewedAt) {
      await this.prisma.financeInvoice.update({ where: { id: invoice.id }, data: { viewedAt: new Date() } });
      await this.activity.create({ invoiceId: invoice.id, eventType: 'viewed', actorType: 'customer' });
    }
    return this.serializePublicInvoice(invoice);
  }

  async createInvoice(scope: Scope, tenantId: string | undefined, actorUserId: string, body: Record<string, unknown>) {
    const invoiceTenantId = scope === 'client' ? tenantId : this.optionalString(body.tenantId);
    if (scope === 'client' && !invoiceTenantId) throw new BadRequestException('Tenant context is required');

    const settings = await this.numbers.settings(scope, invoiceTenantId);
    const lineItems = this.parseLineItems(body.lineItems);
    const totals = this.calculateTotals(lineItems, body.discountType, body.discountValue, body.taxRate);
    const number = this.optionalString(body.number) ?? await this.numbers.next({ scope, tenantId: invoiceTenantId, type: 'invoice', prefix: settings.invoicePrefix });
    const createdByType = scope === 'mcc' ? 'mcc_admin' : 'client';
    const brand = await this.branding.resolve(createdByType, invoiceTenantId);

    const invoice = await this.prisma.financeInvoice.create({
      data: {
        scope,
        tenantId: invoiceTenantId,
        number,
        invoiceType: this.optionalString(body.invoiceType) ?? 'one_time',
        createdByType,
        recipientType: this.optionalString(body.recipientType) ?? (scope === 'mcc' ? 'client' : 'customer'),
        recipientId: this.optionalString(body.recipientId),
        recipientName: this.requiredString(body.recipientName ?? body.customerName, 'recipientName'),
        recipientEmail: this.optionalString(body.recipientEmail ?? body.customerEmail),
        recipientCompany: this.optionalString(body.recipientCompany ?? body.companyName),
        contactId: this.optionalString(body.contactId),
        companyId: this.optionalString(body.companyId),
        proposalId: this.optionalString(body.proposalId),
        subscriptionId: this.optionalString(body.subscriptionId),
        status: this.optionalString(body.status) ?? 'draft',
        billingPeriodStart: this.optionalDate(body.billingPeriodStart),
        billingPeriodEnd: this.optionalDate(body.billingPeriodEnd),
        issueDate: this.optionalDate(body.issueDate) ?? new Date(),
        dueDate: this.optionalDate(body.dueDate),
        subtotal: totals.subtotal,
        discountType: totals.discountType,
        discountValue: totals.discountValue,
        discountAmount: totals.discountAmount,
        taxRate: totals.taxRate,
        taxAmount: totals.taxAmount,
        total: totals.total,
        amountPaid: 0,
        balanceDue: totals.total,
        currency: this.optionalString(body.currency) ?? settings.defaultCurrency,
        paymentTerms: this.optionalString(body.paymentTerms) ?? settings.defaultPaymentTerms,
        notes: this.optionalString(body.notes) ?? settings.invoiceNotesTemplate,
        paymentInstructions: this.optionalString(body.paymentInstructions),
        templateId: this.optionalString(body.templateId) ?? 'modern',
        internalNotes: this.optionalString(body.internalNotes),
        brandingSnapshot: brand as never,
        createdBy: actorUserId,
        lineItems: { create: lineItems },
      },
      include: this.invoiceInclude(),
    });
    await this.activity.create({ invoiceId: invoice.id, eventType: 'created', actorType: createdByType, actorId: actorUserId });
    return this.serializeInvoice(invoice);
  }

  async updateInvoice(scope: Scope, tenantId: string | undefined, id: string, body: Record<string, unknown>) {
    const invoice = await this.findInvoice(scope, tenantId, id);
    if (!['draft', 'sent', 'overdue', 'partial'].includes(invoice.status)) throw new BadRequestException('This invoice cannot be edited');

    const lineItems = Array.isArray(body.lineItems) ? this.parseLineItems(body.lineItems) : undefined;
    const totals = lineItems ? this.calculateTotals(lineItems, body.discountType ?? invoice.discountType, body.discountValue ?? invoice.discountValue, body.taxRate ?? invoice.taxRate) : null;
    const amountPaid = Number(invoice.amountPaid);
    const data: Prisma.FinanceInvoiceUpdateInput = {
      invoiceType: this.optionalString(body.invoiceType),
      recipientName: this.optionalString(body.recipientName ?? body.customerName),
      recipientEmail: this.optionalString(body.recipientEmail ?? body.customerEmail),
      recipientCompany: this.optionalString(body.recipientCompany ?? body.companyName),
      status: this.optionalString(body.status),
      billingPeriodStart: this.optionalDate(body.billingPeriodStart),
      billingPeriodEnd: this.optionalDate(body.billingPeriodEnd),
      issueDate: this.optionalDate(body.issueDate),
      dueDate: this.optionalDate(body.dueDate),
      currency: this.optionalString(body.currency),
      paymentTerms: this.optionalString(body.paymentTerms),
      notes: this.optionalString(body.notes),
      paymentInstructions: this.optionalString(body.paymentInstructions),
      templateId: this.optionalString(body.templateId),
      internalNotes: this.optionalString(body.internalNotes),
    };
    if (totals) {
      Object.assign(data, {
        subtotal: totals.subtotal,
        discountType: totals.discountType,
        discountValue: totals.discountValue,
        discountAmount: totals.discountAmount,
        taxRate: totals.taxRate,
        taxAmount: totals.taxAmount,
        total: totals.total,
        balanceDue: Math.max(0, totals.total - amountPaid),
        status: amountPaid >= totals.total ? 'paid' : amountPaid > 0 ? 'partial' : data.status,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.financeInvoice.update({ where: { id }, data });
      if (lineItems) {
        await tx.financeInvoiceLineItem.deleteMany({ where: { invoiceId: id } });
        await tx.financeInvoiceLineItem.createMany({ data: lineItems.map((item) => ({ ...item, invoiceId: id })) });
      }
    });
    await this.activity.create({ invoiceId: id, eventType: 'updated', actorType: scope === 'mcc' ? 'mcc_admin' : 'client' });
    return this.getInvoice(scope, tenantId, id);
  }

  async deleteInvoice(scope: Scope, tenantId: string | undefined, id: string) {
    await this.findInvoice(scope, tenantId, id);
    await this.prisma.financeInvoice.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.activity.create({ invoiceId: id, eventType: 'deleted', actorType: scope === 'mcc' ? 'mcc_admin' : 'client' });
    return { success: true };
  }

  async duplicateInvoice(scope: Scope, tenantId: string | undefined, id: string, actorUserId: string) {
    const invoice = await this.findInvoice(scope, tenantId, id);
    return this.createInvoice(scope, tenantId, actorUserId, {
      tenantId: invoice.tenantId,
      invoiceType: invoice.invoiceType,
      recipientType: invoice.recipientType,
      recipientName: `${invoice.recipientName} Copy`,
      recipientEmail: invoice.recipientEmail,
      recipientCompany: invoice.recipientCompany,
      currency: invoice.currency,
      paymentTerms: invoice.paymentTerms,
      notes: invoice.notes,
      paymentInstructions: invoice.paymentInstructions,
      lineItems: invoice.lineItems.map((item) => ({
        serviceType: item.serviceType,
        planName: item.planName,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discountPercentage: Number(item.discountPercentage),
        mccCost: Number(item.mccCost),
      })),
    });
  }

  async markPaid(scope: Scope, tenantId: string | undefined, id: string, actorUserId: string, body: Record<string, unknown>) {
    const invoice = await this.findInvoice(scope, tenantId, id);
    const amount = this.optionalNumber(body.amount, Number(invoice.balanceDue)) ?? Number(invoice.balanceDue);
    return this.createPayment(scope, tenantId, actorUserId, {
      invoiceId: id,
      amount,
      method: this.optionalString(body.method) ?? 'manual',
      status: 'completed',
      notes: this.optionalString(body.notes) ?? 'Marked as paid',
    });
  }

  async voidInvoice(scope: Scope, tenantId: string | undefined, id: string, actorUserId: string, body: Record<string, unknown>) {
    await this.findInvoice(scope, tenantId, id);
    const invoice = await this.prisma.financeInvoice.update({
      where: { id },
      data: { status: 'void', voidedAt: new Date(), voidReason: this.optionalString(body.reason) },
      include: this.invoiceInclude(),
    });
    await this.activity.create({ invoiceId: id, eventType: 'voided', actorType: scope === 'mcc' ? 'mcc_admin' : 'client', actorId: actorUserId });
    return this.serializeInvoice(invoice);
  }

  async createPayment(scope: Scope, tenantId: string | undefined, actorUserId: string, body: Record<string, unknown>) {
    const invoiceId = this.optionalString(body.invoiceId);
    const payment = await this.prisma.$transaction(async (tx) => {
      let invoice: Awaited<ReturnType<typeof tx.financeInvoice.findFirst>> = null;
      if (invoiceId) {
        invoice = await tx.financeInvoice.findFirst({ where: { id: invoiceId, ...this.scopeWhere(scope, tenantId), deletedAt: null } });
        if (!invoice) throw new NotFoundException('Invoice not found');
      }
      const status = this.optionalString(body.status) ?? 'completed';
      const created = await tx.financePayment.create({
        data: {
          scope,
          tenantId: this.optionalString(body.tenantId) ?? invoice?.tenantId ?? tenantId,
          invoiceId,
          amount: this.requiredNumber(body.amount, 'amount'),
          currency: this.optionalString(body.currency) ?? invoice?.currency ?? 'USD',
          method: this.optionalString(body.method),
          gateway: this.optionalString(body.gateway),
          gatewayTransactionId: this.optionalString(body.gatewayTransactionId),
          payerType: this.optionalString(body.payerType) ?? invoice?.recipientType ?? 'customer',
          payerId: this.optionalString(body.payerId) ?? invoice?.recipientId,
          status,
          paidAt: this.optionalDate(body.paidAt) ?? new Date(),
          notes: this.optionalString(body.notes),
          recordedBy: actorUserId,
          createdBy: actorUserId,
        },
      });
      if (invoice && ['completed', 'received'].includes(status)) {
        const amountPaid = Number(invoice.amountPaid) + Number(created.amount);
        const total = Number(invoice.total);
        await tx.financeInvoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid,
            balanceDue: Math.max(0, total - amountPaid),
            status: amountPaid >= total ? 'paid' : amountPaid > 0 ? 'partial' : invoice.status,
            paidAt: amountPaid >= total ? new Date() : invoice.paidAt,
          },
        });
      }
      return created;
    });
    if (invoiceId) await this.activity.create({ invoiceId, eventType: 'paid', actorType: scope === 'mcc' ? 'mcc_admin' : 'client', actorId: actorUserId, metadata: { amount: Number(payment.amount) } });
    return payment;
  }

  listPayments(scope: Scope, tenantId: string | undefined, query: Record<string, string> = {}) {
    return this.prisma.financePayment.findMany({
      where: { ...this.scopeWhere(scope, tenantId), ...(query.tenantId && scope === 'mcc' ? { tenantId: query.tenantId } : {}) },
      include: { invoice: { select: { id: true, number: true, recipientName: true, status: true } }, tenant: { select: { id: true, companyName: true } } },
      orderBy: { paidAt: 'desc' },
    });
  }

  listCosts(scope: Scope, tenantId: string | undefined, query: Record<string, string>) {
    return this.prisma.financeCost.findMany({
      where: { ...this.scopeWhere(scope, tenantId), ...(query.status ? { status: query.status } : {}), ...(query.tenantId && scope === 'mcc' ? { tenantId: query.tenantId } : {}) },
      include: { tenant: { select: { id: true, companyName: true } } },
      orderBy: { incurredAt: 'desc' },
    });
  }

  createCost(scope: Scope, tenantId: string | undefined, actorUserId: string, body: Record<string, unknown>) {
    return this.prisma.financeCost.create({
      data: {
        scope,
        tenantId: this.optionalString(body.tenantId) ?? tenantId,
        vendor: this.requiredString(body.vendor, 'vendor'),
        category: this.optionalString(body.category),
        amount: this.requiredNumber(body.amount, 'amount'),
        status: this.optionalString(body.status) ?? 'unpaid',
        incurredAt: this.optionalDate(body.incurredAt) ?? new Date(),
        paidAt: this.optionalDate(body.paidAt),
        notes: this.optionalString(body.notes),
        createdBy: actorUserId,
      },
    });
  }

  async updateCost(scope: Scope, tenantId: string | undefined, id: string, body: Record<string, unknown>) {
    await this.getCost(scope, tenantId, id);
    return this.prisma.financeCost.update({
      where: { id },
      data: {
        vendor: this.optionalString(body.vendor),
        category: this.optionalString(body.category),
        amount: this.optionalDecimal(body.amount),
        status: this.optionalString(body.status),
        incurredAt: this.optionalDate(body.incurredAt),
        paidAt: this.optionalDate(body.paidAt),
        notes: this.optionalString(body.notes),
      },
    });
  }

  async deleteCost(scope: Scope, tenantId: string | undefined, id: string) {
    await this.getCost(scope, tenantId, id);
    await this.prisma.financeCost.delete({ where: { id } });
    return { success: true };
  }

  async summary(scope: Scope, tenantId?: string) {
    const [invoices, costs, subscriptions] = await Promise.all([
      this.prisma.financeInvoice.findMany({ where: { ...this.scopeWhere(scope, tenantId), deletedAt: null } }),
      this.prisma.financeCost.findMany({ where: this.scopeWhere(scope, tenantId) }),
      this.prisma.financeSubscription.findMany({ where: { ...this.scopeWhere(scope, tenantId), status: 'active' } }),
    ]);
    const totalInvoiced = invoices.reduce((sum, invoice) => sum + Number(invoice.total), 0);
    const totalPaid = invoices.reduce((sum, invoice) => sum + Number(invoice.amountPaid), 0);
    const unpaid = invoices.filter((invoice) => !['paid', 'void', 'refunded'].includes(invoice.status)).reduce((sum, invoice) => sum + Number(invoice.balanceDue), 0);
    const overdue = invoices.filter((invoice) => invoice.status === 'overdue').reduce((sum, invoice) => sum + Number(invoice.balanceDue), 0);
    const delayed = invoices.filter((invoice) => invoice.status === 'delayed').reduce((sum, invoice) => sum + Number(invoice.balanceDue), 0);
    const totalCosts = costs.reduce((sum, cost) => sum + Number(cost.amount), 0);
    const mrr = subscriptions.reduce((sum, sub) => sum + Number(sub.monthlyAmount), 0);
    return {
      totalInvoiced,
      totalPaid,
      unpaid,
      overdue,
      delayed,
      totalCosts,
      netProfit: totalPaid - totalCosts,
      mrr,
      arr: mrr * 12,
      invoiceCount: invoices.length,
      costCount: costs.length,
      collectionRate: totalInvoiced ? Math.round((totalPaid / totalInvoiced) * 10000) / 100 : 0,
    };
  }

  async analytics(scope: Scope, tenantId?: string) {
    const summary = await this.summary(scope, tenantId);
    const invoices = await this.prisma.financeInvoice.findMany({ where: { ...this.scopeWhere(scope, tenantId), deletedAt: null }, include: { lineItems: true, tenant: { select: { companyName: true } } } });
    const byService = new Map<string, number>();
    const topRecipients = new Map<string, number>();
    for (const invoice of invoices) {
      topRecipients.set(invoice.recipientName, (topRecipients.get(invoice.recipientName) ?? 0) + Number(invoice.total));
      for (const item of invoice.lineItems) byService.set(item.serviceType, (byService.get(item.serviceType) ?? 0) + Number(item.total));
    }
    return {
      summary,
      revenueByService: [...byService.entries()].map(([name, value]) => ({ name, value })),
      topRecipients: [...topRecipients.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value })),
    };
  }

  async settings(scope: Scope, tenantId?: string) {
    return this.numbers.settings(scope, tenantId);
  }

  async updateSettings(scope: Scope, tenantId: string | undefined, body: Record<string, unknown>) {
    const existing = await this.numbers.settings(scope, tenantId);
    return this.prisma.financeSetting.update({
      where: { id: existing.id },
      data: {
        invoicePrefix: this.optionalString(body.invoicePrefix),
        creditNotePrefix: this.optionalString(body.creditNotePrefix),
        defaultPaymentTerms: this.optionalString(body.defaultPaymentTerms),
        defaultCurrency: this.optionalString(body.defaultCurrency),
        bankDetails: body.bankDetails as Prisma.InputJsonValue | undefined,
        acceptedPaymentMethods: Array.isArray(body.acceptedPaymentMethods) ? body.acceptedPaymentMethods as Prisma.InputJsonValue : undefined,
        invoiceFooterText: this.optionalString(body.invoiceFooterText),
        invoiceNotesTemplate: this.optionalString(body.invoiceNotesTemplate),
        latePaymentFeePercentage: this.optionalDecimal(body.latePaymentFeePercentage),
        autoSendInvoices: typeof body.autoSendInvoices === 'boolean' ? body.autoSendInvoices : undefined,
        autoGenerateFromSubscription: typeof body.autoGenerateFromSubscription === 'boolean' ? body.autoGenerateFromSubscription : undefined,
        reminderDays: Array.isArray(body.reminderDays) ? body.reminderDays as Prisma.InputJsonValue : undefined,
        overdueAction: this.optionalString(body.overdueAction),
      },
    });
  }

  listSubscriptions(scope: Scope, tenantId?: string) {
    return this.prisma.financeSubscription.findMany({
      where: this.scopeWhere(scope, tenantId),
      include: { services: true, tenant: { select: { id: true, companyName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSubscription(scope: Scope, tenantId: string | undefined, actorUserId: string, body: Record<string, unknown>) {
    const services = Array.isArray(body.services) ? body.services as Record<string, unknown>[] : [];
    const monthlyAmount = this.requiredNumber(body.monthlyAmount ?? services.reduce((sum, service) => sum + Number(service.price ?? 0), 0), 'monthlyAmount');
    return this.prisma.financeSubscription.create({
      data: {
        scope,
        tenantId: this.optionalString(body.tenantId) ?? tenantId,
        createdByType: scope === 'mcc' ? 'mcc_admin' : 'client',
        subscriberType: this.optionalString(body.subscriberType) ?? (scope === 'mcc' ? 'client' : 'customer'),
        subscriberId: this.optionalString(body.subscriberId),
        subscriberName: this.requiredString(body.subscriberName, 'subscriberName'),
        subscriberEmail: this.optionalString(body.subscriberEmail),
        proposalId: this.optionalString(body.proposalId),
        status: this.optionalString(body.status) ?? 'active',
        billingCycle: this.optionalString(body.billingCycle) ?? 'monthly',
        cycleAnchorDate: this.optionalDate(body.cycleAnchorDate) ?? new Date(),
        currentPeriodStart: this.optionalDate(body.currentPeriodStart),
        currentPeriodEnd: this.optionalDate(body.currentPeriodEnd),
        nextBillingDate: this.optionalDate(body.nextBillingDate),
        monthlyAmount,
        cycleAmount: this.optionalNumber(body.cycleAmount, monthlyAmount) ?? monthlyAmount,
        discountPercentage: this.optionalNumber(body.discountPercentage, 0) ?? 0,
        createdBy: actorUserId,
        services: {
          create: services.map((service) => ({
            serviceType: this.requiredString(service.serviceType, 'serviceType'),
            planName: this.optionalString(service.planName) ?? 'Standard',
            price: this.optionalNumber(service.price, 0) ?? 0,
            mccCost: this.optionalNumber(service.mccCost, 0) ?? 0,
          })),
        },
      },
      include: { services: true },
    });
  }

  listRefunds(scope: Scope, tenantId?: string) {
    return this.prisma.financeRefund.findMany({
      where: this.scopeWhere(scope, tenantId),
      include: { invoice: { select: { id: true, number: true, recipientName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRefund(scope: Scope, tenantId: string | undefined, actorUserId: string, body: Record<string, unknown>) {
    const invoiceId = this.requiredString(body.invoiceId, 'invoiceId');
    const invoice = await this.findInvoice(scope, tenantId, invoiceId);
    const creditNoteNumber = await this.numbers.next({ scope, tenantId: invoice.tenantId ?? undefined, type: 'credit_note' });
    const refund = await this.prisma.financeRefund.create({
      data: {
        scope,
        tenantId: invoice.tenantId,
        invoiceId,
        paymentId: this.optionalString(body.paymentId),
        creditNoteNumber,
        refundType: this.optionalString(body.refundType) ?? 'partial',
        amount: this.requiredNumber(body.amount, 'amount'),
        reason: this.optionalString(body.reason) ?? 'other',
        reasonNotes: this.optionalString(body.reasonNotes),
        processedBy: actorUserId,
      },
    });
    await this.activity.create({ invoiceId, eventType: 'refunded', actorType: scope === 'mcc' ? 'mcc_admin' : 'client', actorId: actorUserId, metadata: { amount: Number(refund.amount) } });
    return refund;
  }

  async listTaxConfigs(scope: Scope, tenantId?: string) {
    return this.prisma.financeTaxConfig.findMany({ where: this.scopeWhere(scope, tenantId), orderBy: { createdAt: 'desc' } });
  }

  createTaxConfig(scope: Scope, tenantId: string | undefined, body: Record<string, unknown>) {
    return this.prisma.financeTaxConfig.create({
      data: {
        scope,
        tenantId: this.optionalString(body.tenantId) ?? tenantId,
        name: this.requiredString(body.name, 'name'),
        rate: this.requiredNumber(body.rate, 'rate'),
        type: this.optionalString(body.type) ?? 'percentage',
        appliesTo: this.optionalString(body.appliesTo) ?? 'all',
        applicableServices: Array.isArray(body.applicableServices) ? body.applicableServices as Prisma.InputJsonValue : undefined,
        region: this.optionalString(body.region),
        isDefault: body.isDefault === true,
        isActive: body.isActive !== false,
      },
    });
  }

  async convertProposalToInvoice(scope: Scope, tenantId: string | undefined, proposalId: string, actorUserId: string) {
    const proposal = await this.prisma.proposal.findFirst({
      where: scope === 'mcc' ? { id: proposalId, scope: 'mcc' } : { id: proposalId, tenantId },
      include: { services: { orderBy: { sortOrder: 'asc' } }, lineItems: true },
    });
    if (!proposal) throw new NotFoundException('Proposal not found');
    return this.createInvoice(scope, tenantId, actorUserId, {
      tenantId: proposal.tenantId,
      proposalId: proposal.id,
      recipientName: proposal.recipientName,
      recipientEmail: proposal.recipientEmail,
      recipientCompany: proposal.companyName,
      contactId: proposal.contactId,
      companyId: proposal.companyId,
      paymentTerms: proposal.paymentTerms,
      discountType: proposal.discountType,
      discountValue: proposal.discountValue,
      lineItems: proposal.services.length ? proposal.services.map((service) => ({
        serviceType: service.serviceType,
        planName: service.planName,
        name: service.planName,
        description: service.customDescription,
        quantity: 1,
        unitPrice: Number(service.listPrice),
        discountPercentage: Number(service.discountPercentage),
        mccCost: Number(service.mccBaseCost),
      })) : proposal.lineItems.map((item) => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
      })),
    });
  }

  async processOverdue(scope: Scope, tenantId?: string) {
    const now = new Date();
    const updated = await this.prisma.financeInvoice.updateMany({
      where: { ...this.scopeWhere(scope, tenantId), deletedAt: null, status: { in: ['sent', 'partial'] }, dueDate: { lt: now } },
      data: { status: 'overdue' },
    });
    await this.jobs.enqueue({ tenantId, queue: 'finance', name: 'flag_overdue_invoices', payload: { scope, updated: updated.count } as never });
    return { updated: updated.count };
  }

  private async findInvoice(scope: Scope, tenantId: string | undefined, id: string) {
    const invoice = await this.prisma.financeInvoice.findFirst({
      where: { id, ...this.scopeWhere(scope, tenantId), deletedAt: null },
      include: this.invoiceInclude(),
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  private async getCost(scope: Scope, tenantId: string | undefined, id: string) {
    const cost = await this.prisma.financeCost.findFirst({ where: { id, ...this.scopeWhere(scope, tenantId) } });
    if (!cost) throw new NotFoundException('Cost not found');
    return cost;
  }

  private invoiceInclude() {
    return {
      lineItems: { orderBy: { sortOrder: 'asc' as const } },
      payments: { orderBy: { paidAt: 'desc' as const } },
      refunds: { orderBy: { createdAt: 'desc' as const } },
      activities: { orderBy: { createdAt: 'desc' as const } },
      tenant: { select: { id: true, companyName: true, email: true } },
    };
  }

  private serializeInvoice(invoice: Prisma.FinanceInvoiceGetPayload<{ include: ReturnType<FinanceService['invoiceInclude']> }>) {
    return {
      ...invoice,
      customerName: invoice.recipientName,
      customerEmail: invoice.recipientEmail,
      lineItems: invoice.lineItems,
      balanceDue: Number(invoice.balanceDue),
    };
  }

  private serializePublicInvoice(invoice: Prisma.FinanceInvoiceGetPayload<{ include: ReturnType<FinanceService['invoiceInclude']> }>) {
    const { internalNotes: _internalNotes, activities: _activities, ...safe } = this.serializeInvoice(invoice);
    return {
      ...safe,
      lineItems: safe.lineItems.map(({ mccCost: _mccCost, creatorMargin: _creatorMargin, ...item }) => item),
    };
  }

  private scopeWhere(scope: Scope, tenantId?: string): { scope: Scope; tenantId?: string } {
    if (scope === 'client') {
      if (!tenantId) throw new BadRequestException('Tenant context is required');
      return { scope, tenantId };
    }
    return { scope, ...(tenantId ? { tenantId } : {}) };
  }

  private parseLineItems(value: unknown) {
    const items = Array.isArray(value) && value.length ? value : [{ name: 'Service', quantity: 1, unitPrice: 0 }];
    return items.map((raw, index) => {
      const item = raw as Record<string, unknown>;
      const quantity = Math.max(this.optionalNumber(item.quantity, 1) ?? 1, 1);
      const unitPrice = this.optionalNumber(item.unitPrice, 0) ?? 0;
      const discountPercentage = Math.min(Math.max(this.optionalNumber(item.discountPercentage, 0) ?? 0, 0), 100);
      const beforeDiscount = quantity * unitPrice;
      const total = Math.round((beforeDiscount - beforeDiscount * discountPercentage / 100) * 100) / 100;
      const mccCost = this.optionalNumber(item.mccCost, 0) ?? 0;
      return {
        serviceType: this.optionalString(item.serviceType) ?? 'custom',
        planName: this.optionalString(item.planName),
        name: this.requiredString(item.name, 'line item name'),
        description: this.optionalString(item.description),
        billingPeriod: this.optionalString(item.billingPeriod),
        features: Array.isArray(item.features) ? item.features as Prisma.InputJsonValue : [],
        quantity,
        unitPrice,
        discountPercentage,
        total,
        mccCost,
        creatorMargin: total - mccCost,
        sortOrder: this.optionalNumber(item.sortOrder, index) ?? index,
      };
    });
  }

  private calculateTotals(lineItems: Array<{ total: number }>, discountTypeValue: unknown, discountValueRaw: unknown, taxRateRaw: unknown) {
    const subtotal = lineItems.reduce((sum, item) => sum + Number(item.total), 0);
    const discountType = this.optionalString(discountTypeValue) ?? 'none';
    const discountValue = this.optionalNumber(discountValueRaw, 0) ?? 0;
    if (!['none', 'percent', 'percentage', 'fixed'].includes(discountType)) throw new BadRequestException('Invalid discount type');
    let discountAmount = 0;
    if (['percent', 'percentage'].includes(discountType)) discountAmount = subtotal * Math.min(Math.max(discountValue, 0), 100) / 100;
    if (discountType === 'fixed') discountAmount = Math.max(discountValue, 0);
    const taxable = Math.max(0, subtotal - discountAmount);
    const taxRate = Math.max(this.optionalNumber(taxRateRaw, 0) ?? 0, 0);
    const taxAmount = taxable * taxRate / 100;
    const total = Math.max(0, taxable + taxAmount);
    return {
      subtotal: this.round(subtotal),
      discountType,
      discountValue,
      discountAmount: this.round(discountAmount),
      taxRate,
      taxAmount: this.round(taxAmount),
      total: this.round(total),
    };
  }

  private requiredString(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${field} is required`);
    return value.trim();
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private requiredNumber(value: unknown, field: string) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) throw new BadRequestException(`${field} must be a number`);
    return numberValue;
  }

  private optionalNumber(value: unknown, fallback?: number) {
    if (value === undefined || value === null || value === '') return fallback;
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) throw new BadRequestException('Invalid number value');
    return numberValue;
  }

  private optionalDecimal(value: unknown) {
    const numberValue = this.optionalNumber(value);
    return numberValue === undefined ? undefined : new Prisma.Decimal(numberValue);
  }

  private optionalDate(value: unknown) {
    if (typeof value !== 'string' || !value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date value');
    return date;
  }

  private round(value: number) {
    return Math.round(value * 100) / 100;
  }
}
