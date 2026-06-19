import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CampaignStatus, EmailEventType, JobStatus, Prisma, SuppressionSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailDeliveryService } from '../providers/services/email-delivery.service';
import { JobsService } from '../providers/services/jobs.service';

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
      include: { recipients: true, events: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  createCampaign(tenantId: string, userId: string, body: Record<string, unknown>) {
    return this.prisma.emailCampaign.create({
      data: {
        tenantId,
        createdBy: userId,
        name: this.requiredString(body.name, 'name'),
        subject: this.requiredString(body.subject, 'subject'),
        fromName: this.requiredString(body.fromName, 'fromName'),
        fromEmail: this.requiredString(body.fromEmail, 'fromEmail'),
        body: this.optionalString(body.body),
        templateId: this.optionalString(body.templateId),
        status: this.optionalEnum(body.status, Object.values(CampaignStatus), CampaignStatus.draft),
        scheduledAt: typeof body.scheduledAt === 'string' ? new Date(body.scheduledAt) : undefined,
        totalRecipients: this.optionalNumber(body.totalRecipients, 0) ?? 0,
        previewText: this.optionalString(body.previewText),
        replyToEmail: this.optionalString(body.replyToEmail),
        bodyPlainText: this.optionalString(body.bodyPlainText),
        scheduledTz: this.optionalString(body.scheduledTz),
        dailySendLimit: this.optionalNumber(body.dailySendLimit),
        throttlePerHour: this.optionalNumber(body.throttlePerHour),
        trackOpens: this.optionalBoolean(body.trackOpens, true),
        trackClicks: this.optionalBoolean(body.trackClicks, true),
        utmSource: this.optionalString(body.utmSource),
        utmMedium: this.optionalString(body.utmMedium),
        utmCampaign: this.optionalString(body.utmCampaign),
        gdprConsent: this.optionalBoolean(body.gdprConsent, false),
        doubleOptIn: this.optionalBoolean(body.doubleOptIn, false),
        companyAddress: this.optionalString(body.companyAddress),
      },
    });
  }

  async updateCampaign(tenantId: string, campaignId: string, body: Record<string, unknown>) {
    await this.ensureCampaign(tenantId, campaignId);
    return this.prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        name: this.optionalString(body.name),
        subject: this.optionalString(body.subject),
        fromName: this.optionalString(body.fromName),
        fromEmail: this.optionalString(body.fromEmail),
        body: this.optionalString(body.body),
        status: this.optionalEnum(body.status, Object.values(CampaignStatus)),
        scheduledAt: typeof body.scheduledAt === 'string' ? new Date(body.scheduledAt) : undefined,
        previewText: this.optionalString(body.previewText),
        replyToEmail: this.optionalString(body.replyToEmail),
        bodyPlainText: this.optionalString(body.bodyPlainText),
        scheduledTz: this.optionalString(body.scheduledTz),
        dailySendLimit: this.optionalNumber(body.dailySendLimit),
        throttlePerHour: this.optionalNumber(body.throttlePerHour),
        trackOpens: this.optionalBoolean(body.trackOpens),
        trackClicks: this.optionalBoolean(body.trackClicks),
        utmSource: this.optionalString(body.utmSource),
        utmMedium: this.optionalString(body.utmMedium),
        utmCampaign: this.optionalString(body.utmCampaign),
        gdprConsent: this.optionalBoolean(body.gdprConsent),
        doubleOptIn: this.optionalBoolean(body.doubleOptIn),
        companyAddress: this.optionalString(body.companyAddress),
      },
    });
  }

  async scheduleCampaign(tenantId: string, campaignId: string, body: Record<string, unknown>) {
    await this.ensureCampaign(tenantId, campaignId);
    const scheduledAt = typeof body.scheduledAt === 'string' ? new Date(body.scheduledAt) : null;
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) throw new BadRequestException('scheduledAt is required');
    return this.prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { scheduledAt, status: CampaignStatus.scheduled },
    });
  }

  async sendCampaignNow(tenantId: string, campaignId: string) {
    const campaign = await this.ensureCampaign(tenantId, campaignId);
    this.assertCampaignSendable(campaign);
    const contacts = await this.prisma.contact.findMany({ where: { tenantId }, take: 500 });
    if (!contacts.length) throw new BadRequestException('Campaign requires at least one CRM contact recipient');
    const suppressed = await this.prisma.suppressionEntry.findMany({
      where: { tenantId, email: { in: contacts.map((contact) => contact.email.toLowerCase()) } },
      select: { email: true },
    });
    const suppressedEmails = new Set(suppressed.map((item) => item.email.toLowerCase()));
    const allowedContacts = contacts.filter((contact) => !suppressedEmails.has(contact.email.toLowerCase()));
    if (!allowedContacts.length) throw new BadRequestException('All campaign recipients are suppressed');

    const recipients = allowedContacts.map((contact) => ({
      campaignId,
      contactId: contact.id,
      email: contact.email.toLowerCase(),
      firstName: contact.firstName,
      lastName: contact.lastName,
      status: 'queued',
    }));

    await this.prisma.$transaction([
      this.prisma.campaignRecipient.deleteMany({ where: { campaignId } }),
      this.prisma.campaignRecipient.createMany({ data: recipients }),
      this.prisma.emailCampaign.update({
        where: { id: campaignId },
        data: {
          status: CampaignStatus.sending,
          totalRecipients: recipients.length,
        },
      }),
    ]);

    const job = await this.jobs.enqueue({
      tenantId,
      queue: 'email-campaigns',
      name: 'email.campaign.send_now',
      payload: { campaignId },
    });

    await this.jobs.mark(job.id, JobStatus.running);
    let sent = 0;
    for (const recipient of await this.prisma.campaignRecipient.findMany({ where: { campaignId } })) {
      await this.delivery.send({
        tenantId,
        campaignId,
        to: recipient.email,
        fromEmail: campaign.fromEmail,
        fromName: campaign.fromName,
        subject: campaign.subject,
        html: this.withTracking(campaign.body, tenantId, campaignId, recipient.id, recipient.email),
        text: campaign.bodyPlainText,
        replyTo: campaign.replyToEmail,
        trackingArgs: { tenantId, campaignId, recipientId: recipient.id },
      });
      await this.prisma.campaignRecipient.update({ where: { id: recipient.id }, data: { status: 'sent', sentAt: new Date() } });
      sent++;
    }

    await this.prisma.emailCampaign.update({ where: { id: campaignId }, data: { status: CampaignStatus.sent, sentAt: new Date() } });
    await this.jobs.mark(job.id, JobStatus.completed);

    return this.getCampaign(tenantId, campaignId);
  }

  async sendTest(tenantId: string, campaignId: string, body: Record<string, unknown>) {
    const campaign = await this.ensureCampaign(tenantId, campaignId);
    this.assertCampaignSendable(campaign);
    const to = this.requiredString(body.to, 'to').toLowerCase();
    await this.ensureNotSuppressed(tenantId, to);
    return this.delivery.send({
      tenantId,
      campaignId,
      to,
      fromEmail: campaign.fromEmail,
      fromName: campaign.fromName,
      subject: `[Test] ${campaign.subject}`,
      html: campaign.body,
      text: campaign.bodyPlainText,
      replyTo: campaign.replyToEmail,
      trackingArgs: { tenantId, campaignId, test: 'true' },
    });
  }

  async deleteCampaign(tenantId: string, campaignId: string) {
    await this.ensureCampaign(tenantId, campaignId);
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

  async handleProviderEvents(body: unknown) {
    const events = Array.isArray(body) ? body : [body];
    let processed = 0;
    for (const event of events) {
      if (!event || typeof event !== 'object') continue;
      const item = event as Record<string, unknown>;
      const campaignId = typeof item.campaignId === 'string' ? item.campaignId : undefined;
      const tenantId = typeof item.tenantId === 'string' ? item.tenantId : undefined;
      const type = this.mapProviderEvent(item.event);
      if (!campaignId || !type) continue;
      const providerId = typeof item.sg_event_id === 'string' ? item.sg_event_id : undefined;
      try {
        await this.prisma.emailEvent.create({
          data: {
            campaignId,
            type,
            providerId,
            url: this.optionalString(item.url),
            occurredAt: typeof item.timestamp === 'number' ? new Date(item.timestamp * 1000) : new Date(),
          },
        });
        if (type === EmailEventType.open) await this.prisma.emailCampaign.update({ where: { id: campaignId }, data: { openCount: { increment: 1 } } });
        if (type === EmailEventType.click) await this.prisma.emailCampaign.update({ where: { id: campaignId }, data: { clickCount: { increment: 1 } } });
        if (type === EmailEventType.bounce) await this.prisma.emailCampaign.update({ where: { id: campaignId }, data: { bounceCount: { increment: 1 } } });
        if (type === EmailEventType.unsubscribe) await this.prisma.emailCampaign.update({ where: { id: campaignId }, data: { unsubCount: { increment: 1 } } });
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
    await this.prisma.suppressionEntry.delete({ where: { id } });
    return { success: true };
  }

  async handleUnsubscribe(token: string) {
    let parsed: { tenantId?: string; email?: string; campaignId?: string };
    try {
      parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    } catch {
      throw new NotFoundException('Invalid unsubscribe token');
    }
    if (!parsed.tenantId || !parsed.email) throw new NotFoundException('Invalid unsubscribe token');
    await this.addSuppression(parsed.tenantId, { email: parsed.email, source: SuppressionSource.unsubscribe, reason: 'Email unsubscribe link' });
    if (parsed.campaignId) {
      await this.prisma.emailCampaign.update({ where: { id: parsed.campaignId }, data: { unsubCount: { increment: 1 } } }).catch(() => undefined);
    }
    return { success: true, message: 'You have been unsubscribed.' };
  }

  async trackEvent(type: string, token: string, meta: { userAgent?: string; ipAddress?: string; url?: string }) {
    const event = await this.prisma.trackingEvent.findFirst({ where: { token } });
    if (!event) throw new NotFoundException('Tracking token not found');
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
    if (event.campaignId && type === 'open') await this.prisma.emailCampaign.update({ where: { id: event.campaignId }, data: { openCount: { increment: 1 } } });
    if (event.campaignId && type === 'click') await this.prisma.emailCampaign.update({ where: { id: event.campaignId }, data: { clickCount: { increment: 1 } } });
    return { success: true };
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

  private assertCampaignSendable(campaign: Awaited<ReturnType<EmailService['ensureCampaign']>>) {
    if (!campaign.companyAddress) throw new BadRequestException('Company address is required before sending');
    if (!campaign.gdprConsent) throw new BadRequestException('Compliance consent is required before sending');
    if (!campaign.fromEmail.includes('@')) throw new BadRequestException('Valid sender email is required');
  }

  private async ensureNotSuppressed(tenantId: string, email: string) {
    const suppressed = await this.prisma.suppressionEntry.findUnique({ where: { tenantId_email: { tenantId, email } } });
    if (suppressed) throw new BadRequestException('Recipient is suppressed');
  }

  private withTracking(body: string | null, tenantId: string, campaignId: string, recipientId: string, email: string) {
    if (!body) return body;
    const token = `${campaignId}.${recipientId}.${Date.now()}`;
    void this.prisma.trackingEvent.create({
      data: { tenantId, campaignId, recipientId, email, type: 'token', token },
    }).catch(() => undefined);
    const unsubToken = Buffer.from(JSON.stringify({ tenantId, email, campaignId })).toString('base64url');
    void this.prisma.unsubscribeToken.create({
      data: { tenantId, email, campaignId, tokenHash: unsubToken, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365) },
    }).catch(() => undefined);
    const baseUrl = process.env.API_PUBLIC_URL ?? 'http://localhost:3001/api';
    const unsubUrl = `${baseUrl}/email/events/unsubscribe/${unsubToken}`;
    const openPixel = `<img src="${baseUrl}/email/events/open/${token}" alt="" width="1" height="1" />`;
    const unsubLink = `<div style="text-align:center;margin-top:20px;font-size:12px;color:#999;"><a href="${unsubUrl}" style="color:#999;">Unsubscribe</a></div>`;
    return `${body}${unsubLink}${openPixel}`;
  }

  private mapProviderEvent(value: unknown) {
    if (value === 'delivered') return EmailEventType.delivered;
    if (value === 'open') return EmailEventType.open;
    if (value === 'click') return EmailEventType.click;
    if (value === 'bounce') return EmailEventType.bounce;
    if (value === 'unsubscribe') return EmailEventType.unsubscribe;
    return null;
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
