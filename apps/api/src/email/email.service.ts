import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CampaignStatus, ContactStatus, DnsRecordStatus, EmailEventType, JobStatus, Prisma, SuppressionSource } from '@prisma/client';
import { createHash, createVerify } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailDeliveryService } from '../providers/services/email-delivery.service';
import { JobsService } from '../providers/services/jobs.service';
import { DnsProviderService } from '../providers/services/dns-provider.service';
import { ContentQaWarning, contentQaWarnings, htmlToPlainText, renderEmailWithTracking, resolveSelectedVariant } from './email-rendering';

type AudienceFilter = {
  mode?: 'all' | 'manual';
  contactIds?: string[];
  statuses?: string[];
  tags?: string[];
  companyId?: string;
};

export type AudiencePreviewResult = {
  total: number;
  suppressed: number;
  allowed: number;
  sample: Array<{ id: string; email: string; firstName: string | null; lastName: string | null }>;
};

export type CampaignPreflightRequest = Record<string, unknown>;

export type CampaignPreflightResult = {
  ready: boolean;
  fields: Record<string, string>;
  checklist: Array<{ key: string; label: string; passed: boolean; blocking: boolean }>;
  blockingErrors: string[];
  warnings: string[];
  contentWarnings: ContentQaWarning[];
  audience: AudiencePreviewResult;
  domain: ReturnType<EmailService['toDomainResponse']> | null;
  duplicateName: boolean;
};

@Injectable()
export class EmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: EmailDeliveryService,
    private readonly jobs: JobsService,
    private readonly dnsProvider: DnsProviderService,
  ) {}

  listCampaigns(tenantId: string, query: Record<string, string>) {
    return this.prisma.emailCampaign.findMany({
      where: { tenantId, ...(query.status ? { status: query.status as CampaignStatus } : {}) },
      orderBy: { createdAt: 'desc' },
      ...this.page(query),
    });
  }

  async getCampaign(tenantId: string, campaignId: string) {
    const campaign = await this.prisma.emailCampaign.findFirst({
      where: { tenantId, id: campaignId },
      include: { recipients: { orderBy: { email: 'asc' } }, events: { orderBy: { occurredAt: 'desc' } } },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async createCampaign(tenantId: string, userId: string, body: Record<string, unknown>) {
    return this.prisma.emailCampaign.create({
      data: this.toCampaignCreateData(tenantId, userId, body),
    });
  }

  async preflightCampaign(tenantId: string, body: CampaignPreflightRequest, campaignId?: string): Promise<CampaignPreflightResult> {
    const fields: Record<string, string> = {};
    const name = this.optionalString(body.name);
    const subject = this.optionalString(body.subject);
    const fromName = this.optionalString(body.fromName);
    const fromEmail = this.optionalString(body.fromEmail)?.toLowerCase();
    const bodyHtml = this.optionalString(body.body);
    const selected = resolveSelectedVariant({
      subject: subject ?? '',
      previewText: this.optionalString(body.previewText),
      body: bodyHtml,
      bodyPlainText: this.optionalString(body.bodyPlainText),
      contentBlocks: this.optionalJson(body.contentBlocks) as Prisma.JsonValue,
      abTestEnabled: this.optionalBoolean(body.abTestEnabled, false),
      abVariants: this.optionalJson(body.abVariants) as Prisma.JsonValue,
      selectedVariant: this.optionalString(body.selectedVariant),
    });

    if (!name) fields.name = 'Campaign name is required';
    if (!subject) fields.subject = 'Subject line is required';
    if (!fromName) fields.fromName = 'Sender name is required';
    if (!fromEmail) fields.fromEmail = 'Sender email is required';
    if (fromEmail && !this.validEmail(fromEmail)) fields.fromEmail = 'Sender email is invalid';
    if (!selected.body && !this.optionalString(body.bodyPlainText)) fields.body = 'Email body is required';
    if (!this.optionalString(body.companyAddress)) fields.companyAddress = 'Company address is required before sending';
    if (!this.optionalBoolean(body.gdprConsent, false)) fields.gdprConsent = 'Marketing consent confirmation is required before sending';
    if (body.abTestEnabled && !this.hasMeaningfulVariantDifference(body)) fields.abVariants = 'Variant B must differ from Variant A';

    const audience = await this.previewAudienceForFilter(tenantId, this.normalizeAudienceFilter(body.recipientFilter), 5000);
    const domainName = fromEmail?.split('@')[1]?.toLowerCase();
    const domain = domainName ? await this.prisma.sendingDomain.findFirst({ where: { tenantId, domain: domainName } }) : null;
    const domainVerified = !!domain && [domain.spfStatus, domain.dkimStatus, domain.dmarcStatus, domain.mxStatus].every((status) => status === DnsRecordStatus.verified);
    const duplicateName = !!name && !!(await this.prisma.emailCampaign.findFirst({
      where: { tenantId, name, ...(campaignId ? { id: { not: campaignId } } : {}) },
      select: { id: true },
    }));
    const contentWarnings = contentQaWarnings({ subject, body: selected.body, previewText: selected.previewText });
    const checklist = [
      { key: 'fields', label: 'Required campaign fields are complete', passed: Object.keys(fields).length === 0, blocking: true },
      { key: 'audience', label: 'Audience has opted-in recipients', passed: audience.allowed > 0, blocking: true },
      { key: 'suppression', label: 'Suppressed contacts excluded', passed: audience.suppressed === 0, blocking: false },
      { key: 'sender_email', label: 'Sender email is valid', passed: !!fromEmail && this.validEmail(fromEmail), blocking: true },
      { key: 'domain_registered', label: 'Sender domain is added', passed: !!domain, blocking: true },
      { key: 'domain_verified', label: 'SPF, DKIM, DMARC, and MX are verified', passed: domainVerified, blocking: true },
      { key: 'content_qa', label: 'Content QA has no blocking issues', passed: !contentWarnings.some((warning) => warning.severity === 'error'), blocking: true },
      { key: 'unsubscribe', label: 'Unsubscribe footer will be added automatically', passed: true, blocking: false },
    ];
    const blockingErrors = checklist.filter((item) => item.blocking && !item.passed).map((item) => item.label);
    const warnings = [
      ...checklist.filter((item) => !item.blocking && !item.passed).map((item) => item.label),
      ...(duplicateName ? ['A campaign with this name already exists'] : []),
    ];
    return {
      ready: blockingErrors.length === 0,
      fields,
      checklist,
      blockingErrors,
      warnings,
      contentWarnings,
      audience,
      domain: domain ? this.toDomainResponse(domain) : null,
      duplicateName,
    };
  }

  async createAndScheduleCampaign(tenantId: string, userId: string, body: Record<string, unknown>) {
    if (!process.env.REDIS_URL) throw new BadRequestException('Redis is required for Email Marketing sending and scheduling');
    const scheduledAt = typeof body.scheduledAt === 'string' ? this.parseDate(body.scheduledAt, 'scheduledAt') : null;
    if (!scheduledAt) throw new BadRequestException('scheduledAt is required');
    if (scheduledAt.getTime() <= Date.now()) throw new BadRequestException('scheduledAt must be in the future');
    const preflight = await this.preflightCampaign(tenantId, body);
    if (!preflight.ready) throw new BadRequestException(`Campaign is not ready: ${preflight.blockingErrors.join(', ')}`);
    const campaign = await this.createCampaign(tenantId, userId, body);
    return this.prepareCampaignSend(tenantId, campaign.id, scheduledAt);
  }

  async updateCampaign(tenantId: string, campaignId: string, body: Record<string, unknown>) {
    const campaign = await this.ensureCampaign(tenantId, campaignId);
    if (([CampaignStatus.sending, CampaignStatus.sent] as CampaignStatus[]).includes(campaign.status)) {
      throw new BadRequestException('Sent or sending campaigns cannot be edited');
    }
    return this.prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        name: this.optionalString(body.name),
        subject: this.optionalString(body.subject),
        fromName: this.optionalString(body.fromName),
        fromEmail: this.optionalString(body.fromEmail)?.toLowerCase(),
        body: this.optionalString(body.body),
        contentBlocks: this.optionalJson(body.contentBlocks),
        abTestEnabled: this.optionalBoolean(body.abTestEnabled),
        abVariants: this.optionalJson(body.abVariants),
        selectedVariant: this.optionalString(body.selectedVariant),
        status: this.optionalEnum(body.status, [CampaignStatus.draft, CampaignStatus.cancelled]),
        scheduledAt: typeof body.scheduledAt === 'string' ? this.parseDate(body.scheduledAt, 'scheduledAt') : undefined,
        previewText: this.optionalString(body.previewText),
        replyToEmail: this.optionalString(body.replyToEmail)?.toLowerCase(),
        bodyPlainText: this.optionalString(body.bodyPlainText),
        scheduledTz: this.optionalString(body.scheduledTz),
        dailySendLimit: this.optionalPositiveNumber(body.dailySendLimit),
        throttlePerHour: this.optionalPositiveNumber(body.throttlePerHour),
        trackOpens: this.optionalBoolean(body.trackOpens),
        trackClicks: this.optionalBoolean(body.trackClicks),
        utmSource: this.optionalString(body.utmSource),
        utmMedium: this.optionalString(body.utmMedium),
        utmCampaign: this.optionalString(body.utmCampaign),
        gdprConsent: this.optionalBoolean(body.gdprConsent),
        doubleOptIn: this.optionalBoolean(body.doubleOptIn),
        companyAddress: this.optionalString(body.companyAddress),
        recipientFilter: body.recipientFilter !== undefined ? this.normalizeAudienceFilter(body.recipientFilter) as Prisma.InputJsonValue : undefined,
      },
    });
  }

  async previewAudience(tenantId: string, campaignId: string, body: Record<string, unknown>) {
    const campaign = await this.ensureCampaign(tenantId, campaignId);
    const filter = this.normalizeAudienceFilter(body.recipientFilter ?? campaign.recipientFilter);
    return this.previewAudienceForFilter(tenantId, filter, 500);
  }

  async readiness(tenantId: string, campaignId: string) {
    const campaign = await this.ensureCampaign(tenantId, campaignId);
    const selected = resolveSelectedVariant(campaign);
    const filter = this.normalizeAudienceFilter(campaign.recipientFilter);
    const contacts = await this.findAudienceContacts(tenantId, filter, 5000);
    const suppressed = contacts.length
      ? await this.prisma.suppressionEntry.findMany({
        where: { tenantId, email: { in: contacts.map((contact) => contact.email.toLowerCase()) } },
        select: { email: true },
      })
      : [];
    const suppressedEmails = new Set(suppressed.map((item) => item.email.toLowerCase()));
    const allowedRecipients = contacts.filter((contact) => !suppressedEmails.has(contact.email.toLowerCase()));
    const domainName = campaign.fromEmail.split('@')[1]?.toLowerCase();
    const domain = domainName ? await this.prisma.sendingDomain.findFirst({ where: { tenantId, domain: domainName } }) : null;
    const domainVerified = !!domain && [domain.spfStatus, domain.dkimStatus, domain.dmarcStatus, domain.mxStatus].every((status) => status === DnsRecordStatus.verified);
    const checklist = [
      { key: 'audience', label: 'Audience has opted-in recipients', passed: allowedRecipients.length > 0, blocking: true },
      { key: 'suppression', label: 'Suppressed contacts excluded', passed: contacts.length === allowedRecipients.length, blocking: false },
      { key: 'sender_email', label: 'Sender email is valid', passed: this.validEmail(campaign.fromEmail), blocking: true },
      { key: 'domain_registered', label: 'Sender domain is added', passed: !!domain, blocking: true },
      { key: 'domain_verified', label: 'SPF, DKIM, DMARC, and MX are verified', passed: domainVerified, blocking: true },
      { key: 'body', label: 'Campaign content is ready', passed: !!(selected.body || campaign.bodyPlainText), blocking: true },
      { key: 'company_address', label: 'Company address is present', passed: !!campaign.companyAddress, blocking: true },
      { key: 'compliance', label: 'Marketing consent confirmation is enabled', passed: !!campaign.gdprConsent, blocking: true },
      { key: 'unsubscribe', label: 'Unsubscribe footer will be added automatically', passed: true, blocking: false },
    ];
    const blockingErrors = checklist.filter((item) => item.blocking && !item.passed).map((item) => item.label);
    return {
      ready: blockingErrors.length === 0,
      checklist,
      blockingErrors,
      warnings: checklist.filter((item) => !item.blocking && !item.passed).map((item) => item.label),
      recipients: {
        total: contacts.length,
        suppressed: contacts.length - allowedRecipients.length,
        allowed: allowedRecipients.length,
      },
      domain: domain ? this.toDomainResponse(domain) : null,
    };
  }

  async scheduleCampaign(tenantId: string, campaignId: string, body: Record<string, unknown>) {
    const scheduledAt = typeof body.scheduledAt === 'string' ? this.parseDate(body.scheduledAt, 'scheduledAt') : null;
    if (!scheduledAt) throw new BadRequestException('scheduledAt is required');
    const tz = typeof body.scheduledTz === 'string' ? body.scheduledTz : undefined;
    if (tz) {
      await this.prisma.emailCampaign.update({ where: { id: campaignId }, data: { scheduledTz: tz } });
    }
    if (scheduledAt.getTime() <= Date.now()) throw new BadRequestException('scheduledAt must be in the future');
    return this.prepareCampaignSend(tenantId, campaignId, scheduledAt);
  }

  sendCampaignNow(tenantId: string, campaignId: string) {
    return this.prepareCampaignSend(tenantId, campaignId);
  }

  async cancelCampaign(tenantId: string, campaignId: string) {
    const campaign = await this.ensureCampaign(tenantId, campaignId);
    if (!([CampaignStatus.draft, CampaignStatus.scheduled, CampaignStatus.sending] as CampaignStatus[]).includes(campaign.status)) {
      throw new BadRequestException('Only draft, scheduled, or sending campaigns can be cancelled');
    }
    await this.prisma.campaignRecipient.updateMany({
      where: { campaignId, status: { in: ['queued', 'failed'] } },
      data: { status: 'cancelled' },
    });
    return this.prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.cancelled, cancelledAt: new Date(), completedAt: new Date() },
    });
  }

  async sendTest(tenantId: string, campaignId: string, body: Record<string, unknown>) {
    const campaign = await this.ensureCampaign(tenantId, campaignId);
    await this.assertCampaignSendable(tenantId, campaign);
    const selected = resolveSelectedVariant(campaign);
    const to = this.requiredString(body.to, 'to').toLowerCase();
    await this.ensureNotSuppressed(tenantId, to);
    const rendered = await renderEmailWithTracking({ store: this.prisma, body: selected.body, tenantId, campaignId, recipientId: `test-${Date.now()}`, email: to, trackOpens: campaign.trackOpens, trackClicks: campaign.trackClicks, companyAddress: campaign.companyAddress, subject: selected.subject });
    return this.delivery.send({
      tenantId,
      campaignId,
      to,
      fromEmail: campaign.fromEmail,
      fromName: campaign.fromName,
      subject: `[Test] ${selected.subject}`,
      html: rendered?.html ?? selected.body,
      text: campaign.bodyPlainText,
      replyTo: campaign.replyToEmail,
      unsubscribeUrl: rendered?.unsubscribeUrl,
      trackingArgs: { tenantId, campaignId, test: 'true' },
    });
  }

  async deleteCampaign(tenantId: string, campaignId: string) {
    const campaign = await this.ensureCampaign(tenantId, campaignId);
    if (campaign.status === CampaignStatus.sending) throw new BadRequestException('Cancel sending campaigns before deleting');
    await this.prisma.emailCampaign.delete({ where: { id: campaignId } });
    return { success: true };
  }

  listTemplates(tenantId: string) {
    return this.prisma.emailTemplate.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  }

  createTemplate(tenantId: string, userId: string, body: Record<string, unknown>) {
    return this.prisma.emailTemplate.create({
      data: {
        tenantId,
        createdBy: userId,
        name: this.requiredString(body.name, 'name'),
        subject: this.requiredString(body.subject, 'subject'),
        body: this.requiredString(body.body, 'body'),
        contentBlocks: this.optionalJson(body.contentBlocks),
        category: this.optionalString(body.category),
      },
    });
  }

  async updateTemplate(tenantId: string, templateId: string, body: Record<string, unknown>) {
    const existing = await this.ensureTemplate(tenantId, templateId);
    await this.saveTemplateVersion(templateId, existing.subject, existing.body, typeof body._changedBy === 'string' ? body._changedBy : 'unknown', typeof body._changeNote === 'string' ? body._changeNote : undefined).catch(() => undefined);
    return this.prisma.emailTemplate.update({
      where: { id: templateId },
      data: {
        name: this.optionalString(body.name),
        subject: this.optionalString(body.subject),
        body: this.optionalString(body.body),
        contentBlocks: this.optionalJson(body.contentBlocks),
        category: this.optionalString(body.category),
      },
    });
  }

  async deleteTemplate(tenantId: string, templateId: string) {
    await this.ensureTemplate(tenantId, templateId);
    await this.prisma.emailTemplate.delete({ where: { id: templateId } });
    return { success: true };
  }

  async handleProviderEvents(body: unknown, headers: Record<string, string | string[] | undefined> = {}) {
    this.verifySendGridWebhook(body, headers);
    const events = Array.isArray(body) ? body : [body];
    let processed = 0;
    for (const event of events) {
      if (!event || typeof event !== 'object') continue;
      const item = event as Record<string, unknown>;
      const campaignId = typeof item.campaignId === 'string' ? item.campaignId : undefined;
      const tenantId = typeof item.tenantId === 'string' ? item.tenantId : undefined;
      const recipientId = typeof item.recipientId === 'string' ? item.recipientId : undefined;
      const type = this.mapProviderEvent(item.event, item);
      if (!campaignId || !type) continue;
      const providerId = typeof item.sg_event_id === 'string' ? item.sg_event_id : undefined;
      const eventKey = providerId ? `sendgrid:${providerId}` : this.eventKey(campaignId, recipientId, type, String(item.timestamp ?? Date.now()), this.optionalString(item.url));
      const duplicate = await this.prisma.emailEvent.findFirst({ where: { eventKey } });
      if (duplicate) continue;
      try {
        await this.recordEmailEvent({
          campaignId,
          recipientId,
          type,
          providerId,
          eventKey,
          url: this.optionalString(item.url),
          occurredAt: typeof item.timestamp === 'number' ? new Date(item.timestamp * 1000) : new Date(),
        });
        const suppressTypes: EmailEventType[] = [EmailEventType.bounce, EmailEventType.unsubscribe, EmailEventType.complaint];
        if (suppressTypes.includes(type) && tenantId && typeof item.email === 'string') {
          const source = type === EmailEventType.complaint ? SuppressionSource.complaint
            : type === EmailEventType.unsubscribe ? SuppressionSource.unsubscribe
            : SuppressionSource.bounce;
          await this.addSuppression(tenantId, { email: item.email, source, reason: String(item.reason ?? item.event ?? type) });
        }
        processed++;
      } catch {
        continue;
      }
    }
    return { processed };
  }

  listSuppressions(tenantId: string) {
    return this.prisma.suppressionEntry.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  }

  addSuppression(tenantId: string, body: Record<string, unknown>) {
    const email = this.requiredString(body.email, 'email').toLowerCase();
    const source = this.optionalEnum(body.source, Object.values(SuppressionSource), SuppressionSource.manual) ?? SuppressionSource.manual;
    return this.prisma.suppressionEntry.upsert({
      where: { tenantId_email: { tenantId, email } },
      create: { tenantId, email, source, reason: this.optionalString(body.reason) },
      update: { source, reason: this.optionalString(body.reason) },
    });
  }

  async bulkImportSuppressions(tenantId: string, entries: Array<{ email: string; source?: string; reason?: string }>) {
    if (!entries?.length) throw new BadRequestException('No entries provided');
    let imported = 0;
    for (const entry of entries.slice(0, 10000)) {
      const email = entry.email?.trim()?.toLowerCase();
      if (!email || !this.validEmail(email)) continue;
      const source = Object.values(SuppressionSource).includes(entry.source as SuppressionSource)
        ? (entry.source as SuppressionSource) : SuppressionSource.import;
      await this.prisma.suppressionEntry.upsert({
        where: { tenantId_email: { tenantId, email } },
        create: { tenantId, email, source, reason: entry.reason ?? 'Bulk import' },
        update: {},
      }).catch(() => undefined);
      imported++;
    }
    await this.logCompliance(tenantId, 'bulk', 'bulk_suppression_import', 'admin', { count: imported }).catch(() => undefined);
    return { imported, total: entries.length };
  }

  async exportSuppressions(tenantId: string) {
    const entries = await this.prisma.suppressionEntry.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
    const header = 'email,source,reason,createdAt';
    const rows = entries.map(e => `${e.email},${e.source},${(e.reason ?? '').replace(/,/g, ';')},${e.createdAt.toISOString()}`);
    return { csv: [header, ...rows].join('\n'), count: entries.length };
  }

  async removeSuppression(tenantId: string, id: string) {
    const suppression = await this.prisma.suppressionEntry.findFirst({ where: { tenantId, id } });
    if (!suppression) throw new NotFoundException('Suppression not found');
    await this.prisma.suppressionEntry.delete({ where: { id } });
    return { success: true };
  }

  async handleUnsubscribe(token: string) {
    const tokenHash = this.hash(token);
    const record = await this.prisma.unsubscribeToken.findUnique({ where: { tokenHash } });
    if (!record || (record.expiresAt && record.expiresAt.getTime() < Date.now())) throw new NotFoundException('Invalid unsubscribe token');
    await this.addSuppression(record.tenantId, { email: record.email, source: SuppressionSource.unsubscribe, reason: 'Email unsubscribe link' });
    await this.logCompliance(record.tenantId, record.email, 'unsubscribe', 'email_link', { campaignId: record.campaignId }).catch(() => undefined);
    await this.prisma.unsubscribeToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    if (record.campaignId) {
      await this.prisma.campaignRecipient.updateMany({
        where: { campaignId: record.campaignId, email: record.email.toLowerCase() },
        data: { status: 'unsubscribed', unsubscribedAt: new Date() },
      });
      await this.recordEmailEvent({
        campaignId: record.campaignId,
        type: EmailEventType.unsubscribe,
        eventKey: `unsubscribe:${record.id}`,
        occurredAt: new Date(),
      }).catch(() => undefined);
    }
    return { success: true, message: 'You have been unsubscribed.' };
  }

  async trackEvent(type: string, token: string, meta: { userAgent?: string; ipAddress?: string; url?: string }) {
    const event = await this.prisma.trackingEvent.findFirst({ where: { token } });
    if (!event || !event.campaignId) throw new NotFoundException('Tracking token not found');
    const normalizedType = type === 'click' ? EmailEventType.click : EmailEventType.open;
    const eventKey = type === 'click'
      ? `${type}:${token}:${event.recipientId ?? event.email ?? ''}:${meta.url ?? ''}`
      : `${type}:${token}:${event.recipientId ?? event.email ?? ''}`;
    const existing = await this.prisma.emailEvent.findFirst({ where: { eventKey } });
    await this.prisma.trackingEvent.create({
      data: {
        tenantId: event.tenantId,
        campaignId: event.campaignId,
        coldCampaignId: event.coldCampaignId,
        recipientId: event.recipientId,
        email: event.email,
        type,
        url: meta.url,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });
    if (!existing) {
      await this.recordEmailEvent({
        campaignId: event.campaignId,
        recipientId: event.recipientId ?? undefined,
        type: normalizedType,
        eventKey,
        url: meta.url,
        occurredAt: new Date(),
      }).catch(() => undefined);
    }
    return { success: true, redirectUrl: type === 'click' ? meta.url : undefined };
  }

  async listRecipients(tenantId: string, campaignId: string, opts?: { page?: number; pageSize?: number; status?: string; search?: string }) {
    await this.ensureCampaign(tenantId, campaignId);
    const page = Math.max(opts?.page ?? 1, 1);
    const pageSize = Math.min(Math.max(opts?.pageSize ?? 50, 1), 200);
    const where: Record<string, unknown> = { campaignId };
    if (opts?.status) where.status = opts.status;
    if (opts?.search) where.email = { contains: opts.search.toLowerCase(), mode: 'insensitive' };
    const [data, total] = await Promise.all([
      this.prisma.campaignRecipient.findMany({ where, orderBy: { email: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.campaignRecipient.count({ where }),
    ]);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  listEvents(tenantId: string, campaignId: string) {
    return this.ensureCampaign(tenantId, campaignId).then(() =>
      this.prisma.emailEvent.findMany({ where: { campaignId }, orderBy: { occurredAt: 'desc' }, take: 500 }),
    );
  }

  async analytics(tenantId: string, campaignId: string) {
    const campaign = await this.getCampaign(tenantId, campaignId);
    const recipients = campaign.recipients;
    const total = recipients.length;
    const sent = recipients.filter((recipient) => recipient.status === 'sent').length;
    const failed = recipients.filter((recipient) => recipient.status === 'failed').length;
    return {
      campaignId,
      totalRecipients: total,
      sent,
      failed,
      queued: recipients.filter((recipient) => recipient.status === 'queued').length,
      openCount: campaign.openCount,
      clickCount: campaign.clickCount,
      bounceCount: campaign.bounceCount,
      unsubCount: campaign.unsubCount,
      openRate: sent ? campaign.openCount / sent : 0,
      clickRate: sent ? campaign.clickCount / sent : 0,
      bounceRate: sent ? campaign.bounceCount / sent : 0,
    };
  }

  async abTestResults(tenantId: string, campaignId: string) {
    const campaign = await this.getCampaign(tenantId, campaignId);
    if (!campaign.abTestEnabled || !Array.isArray(campaign.abVariants)) return { enabled: false, variants: [] };
    const variants = (campaign.abVariants as any[]).filter(
      (v) => !!v && typeof v === 'object' && !Array.isArray(v),
    ) as Array<Record<string, unknown>>;
    const results = await Promise.all(variants.map(async (variant) => {
      const vid = variant.id as string;
      const recipients = campaign.recipients.filter(r => r.variantId === vid);
      const sentCount = recipients.filter(r => r.status === 'sent').length;
      const openedCount = recipients.filter(r => r.openedAt).length;
      const clickedCount = recipients.filter(r => r.clickedAt).length;
      return {
        id: vid,
        name: (variant.name as string) ?? vid,
        subject: (variant.subject as string) ?? campaign.subject,
        recipients: recipients.length,
        sent: sentCount,
        opens: openedCount,
        clicks: clickedCount,
        openRate: sentCount > 0 ? openedCount / sentCount : 0,
        clickRate: sentCount > 0 ? clickedCount / sentCount : 0,
      };
    }));
    const noVariant = campaign.recipients.filter(r => !r.variantId);
    if (noVariant.length > 0) {
      const nSent = noVariant.filter(r => r.status === 'sent').length;
      results.push({ id: 'control', name: 'Control (Original)', subject: campaign.subject, recipients: noVariant.length, sent: nSent, opens: noVariant.filter(r => r.openedAt).length, clicks: noVariant.filter(r => r.clickedAt).length, openRate: nSent > 0 ? noVariant.filter(r => r.openedAt).length / nSent : 0, clickRate: nSent > 0 ? noVariant.filter(r => r.clickedAt).length / nSent : 0 });
    }
    const winner = results.length > 0 ? results.reduce((best, v) => v.openRate > best.openRate ? v : best) : null;
    return { enabled: true, variants: results, winnerId: winner?.id, winnerMetric: 'openRate' };
  }

  async linkAnalytics(tenantId: string, campaignId: string) {
    await this.ensureCampaign(tenantId, campaignId);
    const clickEvents = await this.prisma.emailEvent.findMany({
      where: { campaignId, type: EmailEventType.click, url: { not: null } },
      select: { url: true, recipientId: true },
    });
    const urlMap = new Map<string, { clicks: number; uniqueRecipients: Set<string> }>();
    for (const event of clickEvents) {
      if (!event.url) continue;
      const entry = urlMap.get(event.url) ?? { clicks: 0, uniqueRecipients: new Set() };
      entry.clicks++;
      if (event.recipientId) entry.uniqueRecipients.add(event.recipientId);
      urlMap.set(event.url, entry);
    }
    return Array.from(urlMap.entries())
      .map(([url, data]) => ({ url, totalClicks: data.clicks, uniqueClickers: data.uniqueRecipients.size }))
      .sort((a, b) => b.totalClicks - a.totalClicks);
  }

  async aggregateAnalytics(tenantId: string) {
    const campaigns = await this.prisma.emailCampaign.findMany({
      where: { tenantId, status: { in: ['sent', 'partial_failed', 'sending'] } },
      select: { id: true, name: true, status: true, totalRecipients: true, openCount: true, clickCount: true, bounceCount: true, unsubCount: true, sentAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const totals = campaigns.reduce((acc, c) => ({
      totalSent: acc.totalSent + c.totalRecipients,
      totalOpens: acc.totalOpens + c.openCount,
      totalClicks: acc.totalClicks + c.clickCount,
      totalBounces: acc.totalBounces + c.bounceCount,
      totalUnsubs: acc.totalUnsubs + c.unsubCount,
    }), { totalSent: 0, totalOpens: 0, totalClicks: 0, totalBounces: 0, totalUnsubs: 0 });
    return {
      campaignCount: campaigns.length,
      ...totals,
      avgOpenRate: totals.totalSent > 0 ? totals.totalOpens / totals.totalSent : 0,
      avgClickRate: totals.totalSent > 0 ? totals.totalClicks / totals.totalSent : 0,
      avgBounceRate: totals.totalSent > 0 ? totals.totalBounces / totals.totalSent : 0,
      campaigns: campaigns.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        totalRecipients: c.totalRecipients,
        openRate: c.totalRecipients > 0 ? c.openCount / c.totalRecipients : 0,
        clickRate: c.totalRecipients > 0 ? c.clickCount / c.totalRecipients : 0,
        sentAt: c.sentAt,
      })),
    };
  }

  listDomains(tenantId: string) {
    return this.prisma.sendingDomain.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    }).then((domains) => domains.map((domain) => this.toDomainResponse(domain)));
  }

  async addDomain(tenantId: string, body: Record<string, unknown>) {
    const domain = this.requiredString(body.domain, 'domain').toLowerCase();
    const created = await this.prisma.sendingDomain.create({
      data: {
        tenantId,
        domain,
        trackingDomain: this.optionalString(body.trackingDomain),
        trackingCnameValue: this.optionalString(body.trackingCnameValue),
      },
    });
    await this.completeOnboardingItem(tenantId, 'add_domain', 'Add domain');
    return this.toDomainResponse(created);
  }

  async updateDomainDnsRecords(tenantId: string, domainId: string, body: Record<string, unknown>) {
    const domain = await this.ensureDomain(tenantId, domainId);
    const dkimType = this.optionalString(body.dkimType)?.toUpperCase();
    if (dkimType && !['TXT', 'CNAME'].includes(dkimType)) throw new BadRequestException('dkimType must be TXT or CNAME');
    const dkimSelector = this.optionalString(body.dkimSelector);
    const updated = await this.prisma.sendingDomain.update({
      where: { id: domain.id },
      data: {
        dkimSelector,
        dkimType,
        dkimHost: this.optionalString(body.dkimHost) ?? (dkimSelector ? `${dkimSelector}._domainkey.${domain.domain}` : undefined),
        dkimValue: this.optionalString(body.dkimValue),
        trackingDomain: this.optionalString(body.trackingDomain),
        trackingCnameValue: this.optionalString(body.trackingCnameValue),
        dkimStatus: DnsRecordStatus.not_set,
        trackingDomainActive: false,
      },
    });
    return this.toDomainResponse(updated);
  }

  async verifyDomain(tenantId: string, domainId: string) {
    const domain = await this.ensureDomain(tenantId, domainId);
    const verification = await this.dnsProvider.verify(domain.domain, domain);
    const updated = await this.prisma.sendingDomain.update({
      where: { id: domainId },
      data: {
        spfStatus: verification.spfValid ? DnsRecordStatus.verified : DnsRecordStatus.not_set,
        dkimStatus: verification.dkimValid ? DnsRecordStatus.verified : DnsRecordStatus.not_set,
        dmarcStatus: verification.dmarcValid ? DnsRecordStatus.verified : DnsRecordStatus.not_set,
        mxStatus: verification.mxValid ? DnsRecordStatus.verified : DnsRecordStatus.not_set,
        trackingDomainActive: verification.trackingValid,
        lastCheckedAt: new Date(),
      },
    });
    if ([updated.spfStatus, updated.dkimStatus, updated.dmarcStatus, updated.mxStatus].every((status) => status === DnsRecordStatus.verified)) {
      await this.completeOnboardingItem(tenantId, 'verify_dns', 'Verify DNS');
    }
    return this.toDomainResponse(updated);
  }

  async removeDomain(tenantId: string, domainId: string) {
    await this.ensureDomain(tenantId, domainId);
    await this.prisma.sendingDomain.delete({ where: { id: domainId } });
    return { success: true };
  }

  async createFollowUpCampaign(tenantId: string, userId: string, campaignId: string, body: Record<string, unknown>) {
    const source = await this.ensureCampaign(tenantId, campaignId);
    const segment = this.optionalEnum(body.segment, ['openers', 'clickers', 'non_openers'], 'clickers') ?? 'clickers';
    const recipients = await this.prisma.campaignRecipient.findMany({ where: { campaignId } });
    const contactIds = recipients
      .filter((recipient) => {
        if (segment === 'openers') return !!recipient.openedAt;
        if (segment === 'clickers') return !!recipient.clickedAt;
        return !recipient.openedAt;
      })
      .map((recipient) => recipient.contactId)
      .filter((id): id is string => !!id);
    const followUp = await this.createCampaign(tenantId, userId, {
      name: `${source.name} ${segment.replace('_', ' ')} follow-up`,
      subject: `Re: ${source.subject}`,
      fromName: source.fromName,
      fromEmail: source.fromEmail,
      replyToEmail: source.replyToEmail ?? undefined,
      body: source.body ?? '',
      bodyPlainText: source.bodyPlainText ?? undefined,
      companyAddress: source.companyAddress ?? undefined,
      gdprConsent: source.gdprConsent,
      trackOpens: source.trackOpens,
      trackClicks: source.trackClicks,
      recipientFilter: { mode: 'manual', contactIds },
      status: CampaignStatus.draft,
    });
    if (typeof body.scheduledAt === 'string' && body.scheduledAt.trim()) {
      return this.prepareCampaignSend(tenantId, followUp.id, this.parseDate(body.scheduledAt, 'scheduledAt'));
    }
    return followUp;
  }

  private async prepareCampaignSend(tenantId: string, campaignId: string, scheduledAt?: Date) {
    if (!process.env.REDIS_URL) throw new BadRequestException('Redis is required for Email Marketing sending and scheduling');
    const campaign = await this.ensureCampaign(tenantId, campaignId);
    await this.assertCampaignSendable(tenantId, campaign);
    if (!([CampaignStatus.draft, CampaignStatus.scheduled, CampaignStatus.partial_failed] as CampaignStatus[]).includes(campaign.status)) {
      throw new BadRequestException('Only draft, scheduled, or partial failed campaigns can be queued');
    }

    const contacts = await this.findAudienceContacts(tenantId, this.normalizeAudienceFilter(campaign.recipientFilter), 5000);
    if (!contacts.length) throw new BadRequestException('Campaign requires at least one CRM contact recipient');
    const suppressed = await this.prisma.suppressionEntry.findMany({
      where: { tenantId, email: { in: contacts.map((contact) => contact.email.toLowerCase()) } },
      select: { email: true },
    });
    const suppressedEmails = new Set(suppressed.map((item) => item.email.toLowerCase()));
    const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentlyEmailed = new Set(
      contacts.filter(c => (c as any).lastEmailSentAt && new Date((c as any).lastEmailSentAt) > recentCutoff).map(c => c.email.toLowerCase()),
    );
    const recipients = contacts
      .filter((contact) => !suppressedEmails.has(contact.email.toLowerCase()) && !recentlyEmailed.has(contact.email.toLowerCase()))
      .map((contact) => ({
        campaignId,
        contactId: contact.id,
        email: contact.email.toLowerCase(),
        firstName: contact.firstName,
        lastName: contact.lastName,
        status: 'queued',
        attempts: 0,
      }));
    if (!recipients.length) throw new BadRequestException('All campaign recipients are suppressed');

    await this.prisma.$transaction([
      this.prisma.campaignRecipient.deleteMany({ where: { campaignId } }),
      this.prisma.campaignRecipient.createMany({ data: recipients }),
      this.prisma.emailCampaign.update({
        where: { id: campaignId },
        data: {
          status: scheduledAt ? CampaignStatus.scheduled : CampaignStatus.sending,
          scheduledAt,
          totalRecipients: recipients.length,
          sentAt: null,
          completedAt: null,
          cancelledAt: null,
          lastError: null,
          openCount: 0,
          clickCount: 0,
          bounceCount: 0,
          unsubCount: 0,
        },
      }),
      this.prisma.emailEvent.deleteMany({ where: { campaignId } }),
      this.prisma.trackingEvent.deleteMany({ where: { tenantId, campaignId } }),
    ]);

    const job = await this.jobs.enqueue({
      tenantId,
      queue: 'email-campaigns',
      name: scheduledAt ? 'email.campaign.scheduled_send' : 'email.campaign.send_now',
      payload: { campaignId },
      scheduledAt,
    });
    await this.completeLaunchOnboarding(tenantId);

    return this.prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { sendJobId: job.id },
      include: { recipients: true, events: true },
    });
  }

  private async assertCampaignSendable(tenantId: string, campaign: Awaited<ReturnType<EmailService['ensureCampaign']>>) {
    const selected = resolveSelectedVariant(campaign);
    if (!campaign.companyAddress) throw new BadRequestException('Company address is required before sending');
    if (!campaign.gdprConsent) throw new BadRequestException('Compliance consent is required before sending');
    if (!selected.body && !campaign.bodyPlainText) throw new BadRequestException('Campaign body is required before sending');
    if (!this.validEmail(campaign.fromEmail)) throw new BadRequestException('Valid sender email is required');
    await this.assertSenderDomainVerified(tenantId, campaign.fromEmail);
  }

  private async assertSenderDomainVerified(tenantId: string, fromEmail: string) {
    const domain = fromEmail.split('@')[1]?.toLowerCase();
    if (!domain) throw new BadRequestException('Valid sender domain is required');
    const sendingDomain = await this.prisma.sendingDomain.findFirst({ where: { tenantId, domain } });
    if (!sendingDomain) throw new BadRequestException(`Sender domain ${domain} is not registered`);
    const verified = [sendingDomain.spfStatus, sendingDomain.dkimStatus, sendingDomain.dmarcStatus, sendingDomain.mxStatus]
      .every((status) => status === DnsRecordStatus.verified);
    if (!verified) throw new BadRequestException(`Sender domain ${domain} must have verified SPF, DKIM, DMARC, and MX records before sending`);
  }

  private async ensureDomain(tenantId: string, domainId: string) {
    const domain = await this.prisma.sendingDomain.findFirst({ where: { tenantId, id: domainId } });
    if (!domain) throw new NotFoundException('Sending domain not found');
    return domain;
  }

  private toDomainResponse(domain: {
    domain: string;
    spfStatus?: string;
    dkimStatus?: string;
    dmarcStatus?: string;
    mxStatus?: string;
    dkimType?: string | null;
    dkimHost?: string | null;
    dkimValue?: string | null;
    trackingDomain?: string | null;
    trackingCnameValue?: string | null;
    trackingDomainActive?: boolean;
  } & Record<string, unknown>) {
    return {
      ...domain,
      dnsRecords: this.dnsProvider.requiredRecords(domain),
    };
  }

  private async ensureNotSuppressed(tenantId: string, email: string) {
    const suppressed = await this.prisma.suppressionEntry.findUnique({ where: { tenantId_email: { tenantId, email } } });
    if (suppressed) throw new BadRequestException('Recipient is suppressed');
  }

  private async recordEmailEvent(input: {
    campaignId: string;
    recipientId?: string | null;
    type: EmailEventType;
    providerId?: string;
    eventKey?: string;
    url?: string;
    occurredAt: Date;
  }) {
    const created = await this.prisma.emailEvent.create({
      data: {
        campaignId: input.campaignId,
        recipientId: input.recipientId,
        type: input.type,
        providerId: input.providerId,
        eventKey: input.eventKey,
        url: input.url,
        occurredAt: input.occurredAt,
      },
    });
    if (input.type === EmailEventType.open) {
      await this.prisma.emailCampaign.update({ where: { id: input.campaignId }, data: { openCount: { increment: 1 } } });
      if (input.recipientId) await this.prisma.campaignRecipient.updateMany({ where: { id: input.recipientId, openedAt: null }, data: { openedAt: input.occurredAt } });
    }
    if (input.type === EmailEventType.click) {
      await this.prisma.emailCampaign.update({ where: { id: input.campaignId }, data: { clickCount: { increment: 1 } } });
      if (input.recipientId) await this.prisma.campaignRecipient.updateMany({ where: { id: input.recipientId, clickedAt: null }, data: { clickedAt: input.occurredAt } });
    }
    if (input.type === EmailEventType.bounce || input.type === EmailEventType.soft_bounce) {
      await this.prisma.emailCampaign.update({ where: { id: input.campaignId }, data: { bounceCount: { increment: 1 } } });
      if (input.recipientId) await this.prisma.campaignRecipient.updateMany({ where: { id: input.recipientId }, data: { status: 'bounced', bouncedAt: input.occurredAt } });
    }
    if (input.type === EmailEventType.complaint) {
      await this.prisma.emailCampaign.update({ where: { id: input.campaignId }, data: { unsubCount: { increment: 1 } } });
      if (input.recipientId) await this.prisma.campaignRecipient.updateMany({ where: { id: input.recipientId }, data: { status: 'unsubscribed', unsubscribedAt: input.occurredAt } });
    }
    if (input.type === EmailEventType.unsubscribe) {
      await this.prisma.emailCampaign.update({ where: { id: input.campaignId }, data: { unsubCount: { increment: 1 } } });
      if (input.recipientId) await this.prisma.campaignRecipient.updateMany({ where: { id: input.recipientId }, data: { status: 'unsubscribed', unsubscribedAt: input.occurredAt } });
    }
    return created;
  }

  private async findAudienceContacts(tenantId: string, filter: AudienceFilter, take: number) {
    const where: Prisma.ContactWhereInput = { tenantId, marketingConsent: true };
    if (filter.mode === 'manual' && filter.contactIds?.length) where.id = { in: filter.contactIds };
    const statuses = filter.statuses?.filter((status): status is ContactStatus => Object.values(ContactStatus).includes(status as ContactStatus));
    if (statuses?.length) where.status = { in: statuses };
    if (filter.tags?.length) where.tags = { hasSome: filter.tags };
    if (filter.companyId) where.companyId = filter.companyId;
    return this.prisma.contact.findMany({ where, orderBy: { createdAt: 'desc' }, take });
  }

  private async previewAudienceForFilter(tenantId: string, filter: AudienceFilter, take: number): Promise<AudiencePreviewResult> {
    const contacts = await this.findAudienceContacts(tenantId, filter, take);
    const suppressed = contacts.length
      ? await this.prisma.suppressionEntry.findMany({
        where: { tenantId, email: { in: contacts.map((contact) => contact.email.toLowerCase()) } },
        select: { email: true },
      })
      : [];
    const suppressedEmails = new Set(suppressed.map((item) => item.email.toLowerCase()));
    const allowed = contacts.filter((contact) => !suppressedEmails.has(contact.email.toLowerCase()));
    return {
      total: contacts.length,
      suppressed: contacts.length - allowed.length,
      allowed: allowed.length,
      sample: allowed.slice(0, 10).map((contact) => ({
        id: contact.id,
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
      })),
    };
  }

  private toCampaignCreateData(tenantId: string, userId: string, body: Record<string, unknown>): Prisma.EmailCampaignUncheckedCreateInput {
    return {
      tenantId,
      createdBy: userId,
      name: this.requiredString(body.name, 'name'),
      subject: this.requiredString(body.subject, 'subject'),
      fromName: this.requiredString(body.fromName, 'fromName'),
      fromEmail: this.requiredString(body.fromEmail, 'fromEmail').toLowerCase(),
      body: this.optionalString(body.body),
      contentBlocks: this.optionalJson(body.contentBlocks),
      templateId: this.optionalString(body.templateId),
      abTestEnabled: this.optionalBoolean(body.abTestEnabled, false) ?? false,
      abVariants: this.optionalJson(body.abVariants),
      selectedVariant: this.optionalString(body.selectedVariant),
      status: CampaignStatus.draft,
      scheduledAt: typeof body.scheduledAt === 'string' ? this.parseDate(body.scheduledAt, 'scheduledAt') : undefined,
      totalRecipients: 0,
      previewText: this.optionalString(body.previewText),
      replyToEmail: this.optionalString(body.replyToEmail)?.toLowerCase(),
      bodyPlainText: this.optionalString(body.bodyPlainText),
      scheduledTz: this.optionalString(body.scheduledTz),
      dailySendLimit: this.optionalPositiveNumber(body.dailySendLimit),
      throttlePerHour: this.optionalPositiveNumber(body.throttlePerHour),
      trackOpens: this.optionalBoolean(body.trackOpens, true) ?? true,
      trackClicks: this.optionalBoolean(body.trackClicks, true) ?? true,
      utmSource: this.optionalString(body.utmSource),
      utmMedium: this.optionalString(body.utmMedium),
      utmCampaign: this.optionalString(body.utmCampaign),
      gdprConsent: this.optionalBoolean(body.gdprConsent, false) ?? false,
      doubleOptIn: this.optionalBoolean(body.doubleOptIn, false) ?? false,
      companyAddress: this.optionalString(body.companyAddress),
      recipientFilter: this.normalizeAudienceFilter(body.recipientFilter) as Prisma.InputJsonValue,
    };
  }

  private hasMeaningfulVariantDifference(body: Record<string, unknown>) {
    const variants = Array.isArray(body.abVariants) ? body.abVariants : [];
    const first = variants.find((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item) && item.id === 'a');
    const second = variants.find((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item) && item.id === 'b');
    if (!first || !second) return false;
    return ['subject', 'previewText', 'body'].some((key) => String(first[key] ?? '').trim() !== String(second[key] ?? '').trim());
  }

  private completeLaunchOnboarding(tenantId: string) {
    return this.completeOnboardingItem(tenantId, 'launch_first_campaign', 'Launch first campaign');
  }

  private completeOnboardingItem(tenantId: string, key: string, label: string) {
    return this.prisma.onboardingItem.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { tenantId, key, label, completedAt: new Date() },
      update: { completedAt: new Date() },
    }).catch(() => undefined);
  }

  private normalizeAudienceFilter(value: unknown): AudienceFilter {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { mode: 'all' };
    const raw = value as Record<string, unknown>;
    return {
      mode: raw.mode === 'manual' ? 'manual' : 'all',
      contactIds: Array.isArray(raw.contactIds) ? raw.contactIds.filter((item): item is string => typeof item === 'string') : undefined,
      statuses: Array.isArray(raw.statuses) ? raw.statuses.filter((item): item is string => typeof item === 'string') : undefined,
      tags: Array.isArray(raw.tags) ? raw.tags.filter((item): item is string => typeof item === 'string') : undefined,
      companyId: this.optionalString(raw.companyId),
    };
  }

  private verifySendGridWebhook(body: unknown, headers: Record<string, string | string[] | undefined>) {
    const publicKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;
    if (!publicKey) return;
    const signature = this.header(headers, 'x-twilio-email-event-webhook-signature');
    const timestamp = this.header(headers, 'x-twilio-email-event-webhook-timestamp');
    if (!signature || !timestamp) throw new BadRequestException('Missing SendGrid webhook signature');
    const verifier = createVerify('sha256');
    verifier.update(timestamp + JSON.stringify(body));
    verifier.end();
    const pem = publicKey.includes('BEGIN PUBLIC KEY') ? publicKey : `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;
    if (!verifier.verify(pem, signature, 'base64')) throw new BadRequestException('Invalid SendGrid webhook signature');
  }

  private header(headers: Record<string, string | string[] | undefined>, key: string) {
    const value = headers[key] ?? headers[key.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }

  private async ensureCampaign(tenantId: string, campaignId: string) {
    const campaign = await this.prisma.emailCampaign.findFirst({ where: { tenantId, id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  private async ensureTemplate(tenantId: string, templateId: string) {
    const template = await this.prisma.emailTemplate.findFirst({ where: { tenantId, id: templateId } });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  private mapProviderEvent(value: unknown, rawEvent?: Record<string, unknown>) {
    if (value === 'delivered') return EmailEventType.delivered;
    if (value === 'open') return EmailEventType.open;
    if (value === 'click') return EmailEventType.click;
    if (value === 'bounce' || value === 'dropped') {
      const bounceType = rawEvent?.type as string | undefined;
      return bounceType === 'blocked' || bounceType === 'bounce' ? EmailEventType.bounce : EmailEventType.soft_bounce;
    }
    if (value === 'spamreport' || value === 'spam_report') return EmailEventType.complaint;
    if (value === 'unsubscribe' || value === 'group_unsubscribe') return EmailEventType.unsubscribe;
    return null;
  }

  private eventKey(...parts: Array<string | undefined | null>) {
    return this.hash(parts.filter(Boolean).join(':'));
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private validEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private page(query: Record<string, string>) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 50), 1), 100);
    return { skip: (page - 1) * pageSize, take: pageSize };
  }

  private parseDate(value: string, field: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException(`${field} must be a valid date`);
    return parsed;
  }

  private requiredString(value: unknown, field: string) {
    if (typeof value !== 'string' || value.trim().length === 0) throw new BadRequestException(`${field} is required`);
    return value.trim();
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  }

  private optionalPositiveNumber(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) throw new BadRequestException('Invalid positive number value');
    return parsed;
  }

  private optionalBoolean(value: unknown, fallback?: boolean): boolean | undefined {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return fallback;
  }

  private optionalJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    return value as Prisma.InputJsonValue;
  }

  // ── Template Versioning ──

  async getTemplateVersions(tenantId: string, templateId: string) {
    await this.ensureTemplate(tenantId, templateId);
    return this.prisma.templateVersion.findMany({
      where: { templateId },
      orderBy: { version: 'desc' },
    });
  }

  async restoreTemplateVersion(tenantId: string, templateId: string, versionId: string) {
    await this.ensureTemplate(tenantId, templateId);
    const version = await this.prisma.templateVersion.findFirst({ where: { id: versionId, templateId } });
    if (!version) throw new NotFoundException('Version not found');
    return this.prisma.emailTemplate.update({
      where: { id: templateId },
      data: { subject: version.subject, body: version.body },
    });
  }

  private async saveTemplateVersion(templateId: string, subject: string, body: string, changedBy: string, changeNote?: string) {
    const latest = await this.prisma.templateVersion.findFirst({ where: { templateId }, orderBy: { version: 'desc' } });
    const nextVersion = (latest?.version ?? 0) + 1;
    return this.prisma.templateVersion.create({
      data: { templateId, version: nextVersion, subject, body, changedBy, changeNote },
    });
  }

  // ── Scheduled Reports ──

  async listScheduledReports(tenantId: string) {
    return this.prisma.scheduledReport.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  }

  async createScheduledReport(tenantId: string, userId: string, body: Record<string, unknown>) {
    const name = this.requiredString(body.name, 'name');
    const recipients = Array.isArray(body.recipients) ? body.recipients.filter((r): r is string => typeof r === 'string' && this.validEmail(r)) : [];
    if (!recipients.length) throw new BadRequestException('At least one recipient email is required');
    const frequency = this.optionalEnum(body.frequency, ['daily', 'weekly', 'monthly'], 'weekly') ?? 'weekly';
    const nextSendAt = frequency === 'daily' ? new Date(Date.now() + 86400000) : frequency === 'weekly' ? new Date(Date.now() + 7 * 86400000) : new Date(Date.now() + 30 * 86400000);
    return this.prisma.scheduledReport.create({
      data: { tenantId, name, frequency, recipients, enabled: true, nextSendAt, createdBy: userId },
    });
  }

  async toggleScheduledReport(tenantId: string, reportId: string) {
    const report = await this.prisma.scheduledReport.findFirst({ where: { tenantId, id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    return this.prisma.scheduledReport.update({ where: { id: reportId }, data: { enabled: !report.enabled } });
  }

  async deleteScheduledReport(tenantId: string, reportId: string) {
    const report = await this.prisma.scheduledReport.findFirst({ where: { tenantId, id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    await this.prisma.scheduledReport.delete({ where: { id: reportId } });
    return { success: true };
  }

  // ── MJML Rendering ──

  renderMjml(mjmlSource: string): { html: string; errors: string[] } {
    try {
      const mjml2html = require('mjml');
      const result = mjml2html(mjmlSource, { validationLevel: 'soft' });
      return { html: result.html, errors: result.errors?.map((e: any) => e.message) ?? [] };
    } catch {
      return { html: `<div>${mjmlSource}</div>`, errors: ['MJML library not available — rendered as plain HTML'] };
    }
  }

  private optionalEnum<T extends string>(value: unknown, allowed: T[], fallback?: T) {
    if (value === undefined || value === null || value === '') return fallback;
    if (!allowed.includes(value as T)) throw new BadRequestException('Invalid enum value');
    return value as T;
  }

  // ── Campaign Star/Favorite ──

  async toggleStar(tenantId: string, campaignId: string) {
    const campaign = await this.ensureCampaign(tenantId, campaignId);
    return this.prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { starred: !campaign.starred },
      select: { id: true, starred: true },
    });
  }

  // ── Recipient Engagement Timeline ──

  async recipientTimeline(tenantId: string, campaignId: string, recipientId: string) {
    await this.ensureCampaign(tenantId, campaignId);
    const recipient = await this.prisma.campaignRecipient.findFirst({ where: { id: recipientId, campaignId } });
    if (!recipient) throw new NotFoundException('Recipient not found');
    const events = await this.prisma.emailEvent.findMany({
      where: { campaignId, recipientId },
      orderBy: { occurredAt: 'asc' },
      select: { id: true, type: true, url: true, occurredAt: true },
    });
    const trackingEvents = await this.prisma.trackingEvent.findMany({
      where: { campaignId, recipientId },
      orderBy: { occurredAt: 'asc' },
      select: { id: true, type: true, url: true, userAgent: true, ipAddress: true, occurredAt: true },
    });
    return {
      recipient: { id: recipient.id, email: recipient.email, firstName: recipient.firstName, lastName: recipient.lastName, status: recipient.status, variantId: recipient.variantId },
      events,
      trackingEvents,
    };
  }

  // ── Saved Content Blocks ──

  async listContentBlocks(tenantId: string) {
    return this.prisma.emailTemplate.findMany({
      where: { tenantId, category: 'block' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, body: true, createdAt: true },
    });
  }

  async saveContentBlock(tenantId: string, userId: string, body: Record<string, unknown>) {
    const name = this.requiredString(body.name, 'name');
    const html = this.requiredString(body.body, 'body');
    return this.prisma.emailTemplate.create({
      data: { tenantId, name, subject: name, body: html, category: 'block', createdBy: userId },
    });
  }

  // ── Domain Send Limits ──

  async getDomainLimits(tenantId: string) {
    const domains = await this.prisma.sendingDomain.findMany({
      where: { tenantId },
      select: { id: true, domain: true, currentDailyCap: true, sentToday: true, healthScore: true, purchasedAt: true },
    });
    return domains.map(d => ({
      ...d,
      remaining: Math.max(d.currentDailyCap - d.sentToday, 0),
      isYoungDomain: d.purchasedAt ? (Date.now() - new Date(d.purchasedAt).getTime()) < 30 * 86400000 : false,
    }));
  }

  async updateDomainLimit(tenantId: string, domainId: string, dailyCap: number) {
    const domain = await this.prisma.sendingDomain.findFirst({ where: { tenantId, id: domainId } });
    if (!domain) throw new NotFoundException('Domain not found');
    if (dailyCap < 1 || dailyCap > 10000) throw new BadRequestException('Daily cap must be between 1 and 10000');
    return this.prisma.sendingDomain.update({ where: { id: domainId }, data: { currentDailyCap: dailyCap } });
  }

  // ── Double Opt-In ──

  async sendDoubleOptInEmail(tenantId: string, contactId: string) {
    const contact = await this.prisma.contact.findFirst({ where: { tenantId, id: contactId } });
    if (!contact) throw new NotFoundException('Contact not found');
    if (contact.marketingConsent) return { alreadyConfirmed: true };
    const token = require('crypto').randomBytes(32).toString('base64url');
    const baseUrl = process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3001}/api`;
    const confirmUrl = `${baseUrl}/email/events/confirm-optin/${token}`;
    await this.prisma.unsubscribeToken.create({
      data: { tenantId, email: contact.email, tokenHash: this.hash(token), expiresAt: new Date(Date.now() + 7 * 86400000) },
    });
    const html = `<p>Please confirm your subscription by clicking the link below:</p><p><a href="${confirmUrl}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:white;text-decoration:none;border-radius:6px;">Confirm Subscription</a></p><p>This link expires in 7 days.</p>`;
    await this.delivery.send({
      tenantId, to: contact.email, fromEmail: 'noreply@' + ((await this.prisma.sendingDomain.findFirst({ where: { tenantId } }))?.domain ?? 'example.com'),
      fromName: 'Subscription Confirmation', subject: 'Confirm your email subscription', html,
    });
    await this.logCompliance(tenantId, contact.email, 'double_optin_sent', 'system', { contactId }).catch(() => undefined);
    return { sent: true, email: contact.email };
  }

  async confirmOptIn(token: string) {
    const tokenHash = this.hash(token);
    const record = await this.prisma.unsubscribeToken.findUnique({ where: { tokenHash } });
    if (!record || (record.expiresAt && record.expiresAt.getTime() < Date.now())) throw new NotFoundException('Invalid or expired confirmation link');
    await this.prisma.contact.updateMany({
      where: { tenantId: record.tenantId, email: record.email.toLowerCase() },
      data: { marketingConsent: true, marketingConsentSource: 'double_optin', marketingConsentCapturedAt: new Date() },
    });
    await this.prisma.unsubscribeToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    await this.logCompliance(record.tenantId, record.email, 'double_optin_confirmed', 'email_link').catch(() => undefined);
    return { success: true, message: 'Your subscription is confirmed!' };
  }

  // ── Campaign Comparison ──

  async compareCampaigns(tenantId: string, campaignIds: string[]) {
    if (!campaignIds?.length || campaignIds.length < 2) throw new BadRequestException('At least 2 campaign IDs required');
    const campaigns = await this.prisma.emailCampaign.findMany({
      where: { tenantId, id: { in: campaignIds.slice(0, 5) } },
      select: { id: true, name: true, subject: true, status: true, totalRecipients: true, openCount: true, clickCount: true, bounceCount: true, unsubCount: true, sentAt: true, createdAt: true },
    });
    return campaigns.map(c => ({
      id: c.id, name: c.name, subject: c.subject, status: c.status,
      totalRecipients: c.totalRecipients,
      openRate: c.totalRecipients > 0 ? c.openCount / c.totalRecipients : 0,
      clickRate: c.totalRecipients > 0 ? c.clickCount / c.totalRecipients : 0,
      bounceRate: c.totalRecipients > 0 ? c.bounceCount / c.totalRecipients : 0,
      unsubRate: c.totalRecipients > 0 ? c.unsubCount / c.totalRecipients : 0,
      sentAt: c.sentAt,
    }));
  }

  // ── Audience CSV Template ──

  audienceCsvTemplate() {
    return { csv: 'email,firstName,lastName,phone,jobTitle,company,tags\njane@example.com,Jane,Doe,+1234567890,VP Marketing,Acme Inc,"tag1;tag2"', filename: 'audience-import-template.csv' };
  }

  // ── Campaign Status (lightweight) ──

  async campaignStatus(tenantId: string, campaignId: string) {
    const campaign = await this.prisma.emailCampaign.findFirst({
      where: { tenantId, id: campaignId },
      select: { id: true, status: true, totalRecipients: true, openCount: true, clickCount: true, bounceCount: true, unsubCount: true, lastError: true, sentAt: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const counts = await this.prisma.campaignRecipient.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: true,
    });
    const statusMap = Object.fromEntries(counts.map(c => [c.status, c._count]));
    return { ...campaign, sent: statusMap['sent'] ?? 0, failed: statusMap['failed'] ?? 0, queued: statusMap['queued'] ?? 0, bounced: statusMap['bounced'] ?? 0 };
  }

  // ── Bulk Delete ──

  async bulkDeleteCampaigns(tenantId: string, ids: string[]) {
    if (!ids?.length) throw new BadRequestException('No campaign IDs provided');
    const result = await this.prisma.emailCampaign.deleteMany({ where: { tenantId, id: { in: ids }, status: { in: [CampaignStatus.draft, CampaignStatus.cancelled, CampaignStatus.sent, CampaignStatus.partial_failed] } } });
    return { deleted: result.count };
  }

  // ── Campaign Preview ──

  async previewCampaign(tenantId: string, campaignId: string) {
    const campaign = await this.ensureCampaign(tenantId, campaignId);
    const selected = resolveSelectedVariant(campaign);
    const sampleBody = (selected.body ?? '')
      .replace(/\{\{firstName\}\}/g, 'Jane')
      .replace(/\{\{first_name\}\}/g, 'Jane')
      .replace(/\{\{lastName\}\}/g, 'Doe')
      .replace(/\{\{last_name\}\}/g, 'Doe')
      .replace(/\{\{email\}\}/g, 'jane@example.com')
      .replace(/\{\{companyName\}\}/g, campaign.fromName ?? '')
      .replace(/\{\{company\}\}/g, campaign.fromName ?? '');
    const rendered = await renderEmailWithTracking({
      store: this.prisma, body: sampleBody, tenantId, campaignId,
      recipientId: 'preview', email: 'preview@example.com',
      trackOpens: false, trackClicks: false,
      companyAddress: campaign.companyAddress,
      subject: selected.subject,
    });
    return { html: rendered?.html ?? sampleBody, subject: selected.subject, plainText: htmlToPlainText(sampleBody) };
  }

  // ── CSV Export ──

  async exportRecipientsCsv(tenantId: string, campaignId: string) {
    const campaign = await this.ensureCampaign(tenantId, campaignId);
    const recipients = await this.prisma.campaignRecipient.findMany({ where: { campaignId }, orderBy: { email: 'asc' } });
    const header = 'email,firstName,lastName,status,sentAt,openedAt,clickedAt,bouncedAt,variantId';
    const rows = recipients.map(r =>
      [r.email, r.firstName ?? '', r.lastName ?? '', r.status, r.sentAt?.toISOString() ?? '', r.openedAt?.toISOString() ?? '', r.clickedAt?.toISOString() ?? '', r.bouncedAt?.toISOString() ?? '', r.variantId ?? ''].join(','),
    );
    return { campaignName: campaign.name, csv: [header, ...rows].join('\n'), count: recipients.length };
  }

  // ── View in Browser ──

  async viewInBrowser(tenantId: string, campaignId: string) {
    const campaign = await this.prisma.emailCampaign.findFirst({ where: { tenantId, id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const selected = resolveSelectedVariant(campaign);
    const rendered = await renderEmailWithTracking({
      store: this.prisma, body: selected.body, tenantId, campaignId,
      recipientId: 'browser', email: 'viewer@example.com',
      trackOpens: false, trackClicks: false,
      companyAddress: campaign.companyAddress,
      subject: selected.subject,
    });
    return rendered?.html ?? selected.body ?? '<p>No content</p>';
  }

  // ── Preference Center ──

  async getPreferences(tenantId: string, email: string) {
    return this.prisma.subscriptionPreference.findMany({ where: { tenantId, email: email.toLowerCase() } });
  }

  async updatePreference(tenantId: string, email: string, category: string, subscribed: boolean, meta?: { ipAddress?: string; userAgent?: string }) {
    const result = await this.prisma.subscriptionPreference.upsert({
      where: { tenantId_email_category: { tenantId, email: email.toLowerCase(), category } },
      create: { tenantId, email: email.toLowerCase(), category, subscribed },
      update: { subscribed },
    });
    await this.logCompliance(tenantId, email, subscribed ? 'subscribe' : 'unsubscribe_category', 'preference_center', { category }, meta);
    return result;
  }

  async handlePreferenceCenterUpdate(token: string, preferences: Array<{ category: string; subscribed: boolean }>, meta?: { ipAddress?: string; userAgent?: string }) {
    const tokenHash = this.hash(token);
    const record = await this.prisma.unsubscribeToken.findUnique({ where: { tokenHash } });
    if (!record) throw new NotFoundException('Invalid token');
    for (const pref of preferences) {
      await this.updatePreference(record.tenantId, record.email, pref.category, pref.subscribed, meta);
    }
    return { success: true, updated: preferences.length };
  }

  // ── Compliance Audit Trail ──

  async logCompliance(tenantId: string, email: string, action: string, source: string, details?: Record<string, unknown>, meta?: { ipAddress?: string; userAgent?: string }) {
    return this.prisma.complianceLog.create({
      data: { tenantId, email: email.toLowerCase(), action, source, details: details as any ?? undefined, ipAddress: meta?.ipAddress, userAgent: meta?.userAgent },
    });
  }

  async getComplianceLogs(tenantId: string, email?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (email) where.email = email.toLowerCase();
    return this.prisma.complianceLog.findMany({ where, orderBy: { occurredAt: 'desc' }, take: 200 });
  }

  // ── Campaign Pause/Resume ──

  async pauseCampaign(tenantId: string, campaignId: string) {
    const campaign = await this.ensureCampaign(tenantId, campaignId);
    if (campaign.status !== CampaignStatus.sending) throw new BadRequestException('Only sending campaigns can be paused');
    return this.prisma.emailCampaign.update({ where: { id: campaignId }, data: { status: CampaignStatus.paused }, include: { recipients: true, events: true } });
  }

  async resumeCampaign(tenantId: string, campaignId: string) {
    const campaign = await this.ensureCampaign(tenantId, campaignId);
    if (campaign.status !== CampaignStatus.paused && campaign.status !== CampaignStatus.partial_failed) throw new BadRequestException('Only paused or partial_failed campaigns can be resumed');
    if (!process.env.REDIS_URL) throw new BadRequestException('Redis is required for Email Marketing sending and scheduling');
    await this.prisma.emailCampaign.update({ where: { id: campaignId }, data: { status: CampaignStatus.sending, lastError: null } });
    const job = await this.jobs.enqueue({ tenantId, queue: 'email-campaigns', name: 'email.campaign.resume', payload: { campaignId } });
    return this.prisma.emailCampaign.update({ where: { id: campaignId }, data: { sendJobId: job.id }, include: { recipients: true, events: true } });
  }
}
