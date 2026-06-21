import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CampaignStatus, ContactStatus, DnsRecordStatus, EmailEventType, JobStatus, Prisma, SuppressionSource } from '@prisma/client';
import { createHash, randomBytes, createVerify } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailDeliveryService } from '../providers/services/email-delivery.service';
import { JobsService } from '../providers/services/jobs.service';

type AudienceFilter = {
  mode?: 'all' | 'manual';
  contactIds?: string[];
  statuses?: string[];
  tags?: string[];
  companyId?: string;
};

@Injectable()
export class EmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: EmailDeliveryService,
    private readonly jobs: JobsService,
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
    const requestedStatus = this.optionalEnum(body.status, Object.values(CampaignStatus), CampaignStatus.draft);
    return this.prisma.emailCampaign.create({
      data: {
        tenantId,
        createdBy: userId,
        name: this.requiredString(body.name, 'name'),
        subject: this.requiredString(body.subject, 'subject'),
        fromName: this.requiredString(body.fromName, 'fromName'),
        fromEmail: this.requiredString(body.fromEmail, 'fromEmail').toLowerCase(),
        body: this.optionalString(body.body),
        templateId: this.optionalString(body.templateId),
        status: requestedStatus === CampaignStatus.scheduled ? CampaignStatus.draft : requestedStatus,
        scheduledAt: typeof body.scheduledAt === 'string' ? this.parseDate(body.scheduledAt, 'scheduledAt') : undefined,
        totalRecipients: 0,
        previewText: this.optionalString(body.previewText),
        replyToEmail: this.optionalString(body.replyToEmail)?.toLowerCase(),
        bodyPlainText: this.optionalString(body.bodyPlainText),
        scheduledTz: this.optionalString(body.scheduledTz),
        dailySendLimit: this.optionalPositiveNumber(body.dailySendLimit),
        throttlePerHour: this.optionalPositiveNumber(body.throttlePerHour),
        trackOpens: this.optionalBoolean(body.trackOpens, true),
        trackClicks: this.optionalBoolean(body.trackClicks, true),
        utmSource: this.optionalString(body.utmSource),
        utmMedium: this.optionalString(body.utmMedium),
        utmCampaign: this.optionalString(body.utmCampaign),
        gdprConsent: this.optionalBoolean(body.gdprConsent, false),
        doubleOptIn: this.optionalBoolean(body.doubleOptIn, false),
        companyAddress: this.optionalString(body.companyAddress),
        recipientFilter: this.normalizeAudienceFilter(body.recipientFilter) as Prisma.InputJsonValue,
      },
    });
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
    const contacts = await this.findAudienceContacts(tenantId, filter, 500);
    const suppressed = await this.prisma.suppressionEntry.findMany({
      where: { tenantId, email: { in: contacts.map((contact) => contact.email.toLowerCase()) } },
      select: { email: true },
    });
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

  async scheduleCampaign(tenantId: string, campaignId: string, body: Record<string, unknown>) {
    const scheduledAt = typeof body.scheduledAt === 'string' ? this.parseDate(body.scheduledAt, 'scheduledAt') : null;
    if (!scheduledAt) throw new BadRequestException('scheduledAt is required');
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
    const to = this.requiredString(body.to, 'to').toLowerCase();
    await this.ensureNotSuppressed(tenantId, to);
    return this.delivery.send({
      tenantId,
      campaignId,
      to,
      fromEmail: campaign.fromEmail,
      fromName: campaign.fromName,
      subject: `[Test] ${campaign.subject}`,
      html: await this.withTracking(campaign.body, tenantId, campaignId, `test-${Date.now()}`, to, campaign),
      text: campaign.bodyPlainText,
      replyTo: campaign.replyToEmail,
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
        category: this.optionalString(body.category),
      },
    });
  }

  async updateTemplate(tenantId: string, templateId: string, body: Record<string, unknown>) {
    await this.ensureTemplate(tenantId, templateId);
    return this.prisma.emailTemplate.update({
      where: { id: templateId },
      data: {
        name: this.optionalString(body.name),
        subject: this.optionalString(body.subject),
        body: this.optionalString(body.body),
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
      const type = this.mapProviderEvent(item.event);
      if (!campaignId || !type) continue;
      const providerId = typeof item.sg_event_id === 'string' ? item.sg_event_id : undefined;
      const eventKey = providerId ? `sendgrid:${providerId}` : this.eventKey(campaignId, recipientId, type, String(item.timestamp ?? Date.now()), this.optionalString(item.url));
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
        if ((type === EmailEventType.bounce || type === EmailEventType.unsubscribe) && tenantId && typeof item.email === 'string') {
          await this.addSuppression(tenantId, { email: item.email, source: type === EmailEventType.bounce ? SuppressionSource.bounce : SuppressionSource.unsubscribe, reason: String(item.reason ?? item.event ?? type) });
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
    await this.recordEmailEvent({
      campaignId: event.campaignId,
      recipientId: event.recipientId ?? undefined,
      type: normalizedType,
      eventKey: `${type}:${token}:${event.recipientId ?? event.email ?? ''}`,
      url: meta.url,
      occurredAt: new Date(),
    }).catch(() => undefined);
    return { success: true, redirectUrl: type === 'click' ? meta.url : undefined };
  }

  listRecipients(tenantId: string, campaignId: string) {
    return this.ensureCampaign(tenantId, campaignId).then(() =>
      this.prisma.campaignRecipient.findMany({ where: { campaignId }, orderBy: { email: 'asc' } }),
    );
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
    const recipients = contacts
      .filter((contact) => !suppressedEmails.has(contact.email.toLowerCase()))
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
    if (!campaign.companyAddress) throw new BadRequestException('Company address is required before sending');
    if (!campaign.gdprConsent) throw new BadRequestException('Compliance consent is required before sending');
    if (!campaign.body && !campaign.bodyPlainText) throw new BadRequestException('Campaign body is required before sending');
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

  private async ensureNotSuppressed(tenantId: string, email: string) {
    const suppressed = await this.prisma.suppressionEntry.findUnique({ where: { tenantId_email: { tenantId, email } } });
    if (suppressed) throw new BadRequestException('Recipient is suppressed');
  }

  private async withTracking(body: string | null, tenantId: string, campaignId: string, recipientId: string, email: string, campaign: { trackOpens: boolean; trackClicks: boolean }) {
    if (!body) return body;
    const baseUrl = process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3001}/api`;
    const openToken = randomBytes(24).toString('base64url');
    await this.prisma.trackingEvent.create({
      data: { tenantId, campaignId, recipientId, email, type: 'token', token: openToken },
    }).catch(() => undefined);
    const unsubToken = randomBytes(32).toString('base64url');
    await this.prisma.unsubscribeToken.create({
      data: {
        tenantId,
        email,
        campaignId,
        tokenHash: this.hash(unsubToken),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
      },
    }).catch(() => undefined);
    const unsubUrl = `${baseUrl}/email/events/unsubscribe/${unsubToken}`;
    const trackedBody = campaign.trackClicks ? this.rewriteLinks(body, baseUrl, openToken) : body;
    const openPixel = campaign.trackOpens ? `<img src="${baseUrl}/email/events/open/${openToken}" alt="" width="1" height="1" style="display:none" />` : '';
    const unsubLink = `<div style="text-align:center;margin-top:20px;font-size:12px;color:#999;"><a href="${unsubUrl}" style="color:#999;">Unsubscribe</a></div>`;
    return `${trackedBody}${unsubLink}${openPixel}`;
  }

  private rewriteLinks(body: string, baseUrl: string, token: string) {
    return body.replace(/href=(["'])(https?:\/\/[^"']+)\1/gi, (_match, quote: string, url: string) => {
      const tracked = `${baseUrl}/email/events/click/${token}?url=${encodeURIComponent(url)}`;
      return `href=${quote}${tracked}${quote}`;
    });
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
    if (input.type === EmailEventType.bounce) {
      await this.prisma.emailCampaign.update({ where: { id: input.campaignId }, data: { bounceCount: { increment: 1 } } });
      if (input.recipientId) await this.prisma.campaignRecipient.updateMany({ where: { id: input.recipientId }, data: { status: 'bounced', bouncedAt: input.occurredAt } });
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

  private completeLaunchOnboarding(tenantId: string) {
    return this.prisma.onboardingItem.upsert({
      where: { tenantId_key: { tenantId, key: 'launch_first_campaign' } },
      create: { tenantId, key: 'launch_first_campaign', label: 'Launch first campaign', completedAt: new Date() },
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

  private mapProviderEvent(value: unknown) {
    if (value === 'delivered') return EmailEventType.delivered;
    if (value === 'open') return EmailEventType.open;
    if (value === 'click') return EmailEventType.click;
    if (value === 'bounce' || value === 'dropped') return EmailEventType.bounce;
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

  private optionalEnum<T extends string>(value: unknown, allowed: T[], fallback?: T) {
    if (value === undefined || value === null || value === '') return fallback;
    if (!allowed.includes(value as T)) throw new BadRequestException('Invalid enum value');
    return value as T;
  }
}
