import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ColdCampaignStatus,
  DnsRecordStatus,
  MailboxProvider,
  MailboxStatus,
  WarmupStatus,
} from '@prisma/client';
import * as dns from 'dns';
import * as net from 'net';
import { PrismaService } from '../prisma/prisma.service';
import { DnsProviderService } from '../providers/services/dns-provider.service';
import { JobsService } from '../providers/services/jobs.service';
import { EmailDeliveryService } from '../providers/services/email-delivery.service';
import { EncryptionService } from '../tenants/encryption.service';

@Injectable()
export class ColdEmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dnsProvider: DnsProviderService,
    private readonly jobs: JobsService,
    private readonly emailDelivery: EmailDeliveryService,
    private readonly encryption: EncryptionService,
  ) {}

  // ---------------------------------------------------------------------------
  // Sending Domains
  // ---------------------------------------------------------------------------

  listDomains(tenantId: string) {
    return this.prisma.sendingDomain.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    }).then((domains) => domains.map((domain) => this.toDomainResponse(domain)));
  }

  async addDomain(tenantId: string, body: Record<string, unknown>) {
    const domain = this.requiredString(body.domain, 'domain');
    const created = await this.prisma.sendingDomain.create({
      data: {
        tenantId,
        domain,
        trackingDomain: this.optionalString(body.trackingDomain),
        trackingCnameValue: this.optionalString(body.trackingCnameValue),
      },
    });
    return this.toDomainResponse(created);
  }

  async verifyDomain(tenantId: string, domainId: string, actorUserId?: string) {
    const domain = await this.ensureDomain(tenantId, domainId);
    const verification = await this.dnsProvider.verify(domain.domain, domain);
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.sendingDomain.update({
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
      await tx.auditLog.create({
        data: {
          actorUserId,
          tenantId,
          event: 'domain.dns_verified',
          metadata: { domainId, domain: domain.domain, verification },
        },
      });
      return saved;
    });
    return this.toDomainResponse(updated);
  }

  async updateDnsRecords(tenantId: string, domainId: string, body: Record<string, unknown>, actorUserId?: string) {
    const domain = await this.ensureDomain(tenantId, domainId);
    const dkimType = this.optionalString(body.dkimType)?.toUpperCase();
    if (dkimType && !['TXT', 'CNAME'].includes(dkimType)) {
      throw new BadRequestException('dkimType must be TXT or CNAME');
    }

    const dkimSelector = this.optionalString(body.dkimSelector);
    const dkimHost = this.optionalString(body.dkimHost) ?? (dkimSelector ? `${dkimSelector}._domainkey.${domain.domain}` : undefined);
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.sendingDomain.update({
        where: { id: domainId },
        data: {
          dkimSelector,
          dkimType,
          dkimHost,
          dkimValue: this.optionalString(body.dkimValue),
          trackingDomain: this.optionalString(body.trackingDomain),
          trackingCnameValue: this.optionalString(body.trackingCnameValue),
          dkimStatus: DnsRecordStatus.not_set,
          trackingDomainActive: false,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId,
          tenantId,
          event: 'domain.dns_records.updated',
          metadata: {
            domainId,
            domain: domain.domain,
            fields: Object.keys(body),
          },
        },
      });
      return saved;
    });
    return this.toDomainResponse(updated);
  }

  async removeDomain(tenantId: string, domainId: string) {
    await this.ensureDomain(tenantId, domainId);
    await this.prisma.sendingDomain.delete({ where: { id: domainId } });
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Cold Mailboxes
  // ---------------------------------------------------------------------------

  listMailboxes(tenantId: string) {
    return this.prisma.coldMailbox.findMany({
      where: { tenantId },
      include: { domain: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  createMailbox(tenantId: string, body: Record<string, unknown>) {
    const dailySendLimit = this.optionalNumber(body.dailySendLimit, 40) ?? 40;
    if (dailySendLimit > 50) throw new BadRequestException('dailySendLimit must not exceed 50');

    return this.prisma.coldMailbox.create({
      data: {
        tenantId,
        provider: this.requiredEnum<MailboxProvider>(body.provider, Object.values(MailboxProvider) as MailboxProvider[], 'provider'),
        email: this.requiredString(body.email, 'email'),
        fromName: this.requiredString(body.fromName, 'fromName'),
        replyToEmail: this.optionalString(body.replyToEmail),
        dailySendLimit,
        sendWindowStart: this.optionalString(body.sendWindowStart) ?? '08:00',
        sendWindowEnd: this.optionalString(body.sendWindowEnd) ?? '17:00',
        sendWeekdaysOnly: this.optionalBoolean(body.sendWeekdaysOnly, true),
        minDelaySeconds: this.optionalNumber(body.minDelaySeconds, 180) ?? 180,
        maxDelaySeconds: this.optionalNumber(body.maxDelaySeconds, 480) ?? 480,
        warmupEnabled: this.optionalBoolean(body.warmupEnabled, false),
        signature: this.optionalString(body.signature),
        smtpHost: this.optionalString(body.smtpHost),
        smtpPort: this.optionalNumber(body.smtpPort),
        smtpUser: this.optionalString(body.smtpUser),
        domainId: this.optionalString(body.domainId),
      },
    });
  }

  async updateMailbox(tenantId: string, id: string, body: Record<string, unknown>) {
    await this.ensureMailbox(tenantId, id);

    const dailySendLimit = this.optionalNumber(body.dailySendLimit);
    if (dailySendLimit !== undefined && dailySendLimit > 50) {
      throw new BadRequestException('dailySendLimit must not exceed 50');
    }

    return this.prisma.coldMailbox.update({
      where: { id },
      data: {
        fromName: this.optionalString(body.fromName),
        replyToEmail: this.optionalString(body.replyToEmail),
        dailySendLimit,
        sendWindowStart: this.optionalString(body.sendWindowStart),
        sendWindowEnd: this.optionalString(body.sendWindowEnd),
        sendWeekdaysOnly: this.optionalBoolean(body.sendWeekdaysOnly),
        minDelaySeconds: this.optionalNumber(body.minDelaySeconds),
        maxDelaySeconds: this.optionalNumber(body.maxDelaySeconds),
        warmupEnabled: this.optionalBoolean(body.warmupEnabled),
        signature: this.optionalString(body.signature),
        smtpHost: this.optionalString(body.smtpHost),
        smtpPort: this.optionalNumber(body.smtpPort),
        smtpUser: this.optionalString(body.smtpUser),
        domainId: this.optionalString(body.domainId),
      },
    });
  }

  async removeMailbox(tenantId: string, id: string) {
    await this.ensureMailbox(tenantId, id);
    await this.prisma.coldMailbox.delete({ where: { id } });
    return { success: true };
  }

  async toggleWarmup(tenantId: string, id: string) {
    const mailbox = await this.ensureMailbox(tenantId, id);
    const warmupEnabled = !mailbox.warmupEnabled;
    return this.prisma.coldMailbox.update({
      where: { id },
      data: {
        warmupEnabled,
        warmupStatus: warmupEnabled ? WarmupStatus.warming : WarmupStatus.paused,
        warmupStartedAt: warmupEnabled && !mailbox.warmupStartedAt ? new Date() : mailbox.warmupStartedAt,
      },
    });
  }

  async pauseMailbox(tenantId: string, id: string) {
    await this.ensureMailbox(tenantId, id);
    return this.prisma.coldMailbox.update({
      where: { id },
      data: { status: MailboxStatus.paused },
    });
  }

  async activateMailbox(tenantId: string, id: string) {
    await this.ensureMailbox(tenantId, id);
    return this.prisma.coldMailbox.update({
      where: { id },
      data: { status: MailboxStatus.active },
    });
  }

  // ---------------------------------------------------------------------------
  // Prospect Lists
  // ---------------------------------------------------------------------------

  listProspectLists(tenantId: string) {
    return this.prisma.coldProspectList.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  createProspectList(tenantId: string, userId: string, body: Record<string, unknown>) {
    return this.prisma.coldProspectList.create({
      data: {
        tenantId,
        createdBy: userId,
        name: this.requiredString(body.name, 'name'),
      },
    });
  }

  async getProspectList(tenantId: string, listId: string) {
    const list = await this.prisma.coldProspectList.findFirst({
      where: { tenantId, id: listId },
      include: {
        _count: { select: { prospects: true } },
      },
    });
    if (!list) throw new NotFoundException('Prospect list not found');
    return list;
  }

  async removeProspectList(tenantId: string, listId: string) {
    await this.ensureProspectList(tenantId, listId);
    await this.prisma.coldProspectList.delete({ where: { id: listId } });
    return { success: true };
  }

  async removeProspect(tenantId: string, listId: string, prospectId: string) {
    await this.ensureProspectList(tenantId, listId);
    const prospect = await this.prisma.coldProspect.findFirst({
      where: { id: prospectId, listId },
      select: { id: true, validationStatus: true },
    });
    if (!prospect) throw new NotFoundException('Prospect not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.coldProspect.delete({ where: { id: prospectId } });
      const counts = await tx.coldProspect.groupBy({
        by: ['validationStatus'],
        where: { listId },
        _count: { _all: true },
      });
      const countByStatus = new Map(counts.map((count) => [count.validationStatus, count._count._all]));
      await tx.coldProspectList.update({
        where: { id: listId },
        data: {
          totalCount: counts.reduce((sum, count) => sum + count._count._all, 0),
          validCount: countByStatus.get('valid') ?? 0,
          invalidCount: countByStatus.get('invalid') ?? 0,
          riskyCount: countByStatus.get('risky') ?? 0,
        },
      });
    });

    return { success: true };
  }

  async bulkAddProspects(tenantId: string, listId: string, body: Record<string, unknown>) {
    const list = await this.ensureProspectList(tenantId, listId);

    const prospects = body.prospects;
    if (!Array.isArray(prospects) || prospects.length === 0) {
      throw new BadRequestException('prospects array is required and must not be empty');
    }

    // Deduplicate by email (case-insensitive), keeping last occurrence
    const seen = new Map<string, Record<string, unknown>>();
    for (const p of prospects) {
      if (!p || typeof p !== 'object') continue;
      const item = p as Record<string, unknown>;
      const email = this.requiredString(item.email, 'email').toLowerCase();
      seen.set(email, item);
    }

    // Fetch existing emails in this list to skip duplicates
    const existingProspects = await this.prisma.coldProspect.findMany({
      where: { listId },
      select: { email: true },
    });
    const existingEmails = new Set(existingProspects.map((p: { email: string }) => p.email.toLowerCase()));

    const toCreate: Array<{
      listId: string;
      email: string;
      firstName: string;
      lastName: string;
      companyName?: string;
      jobTitle?: string;
      customVar1?: string;
      customVar2?: string;
      customVar3?: string;
      customVar4?: string;
      customVar5?: string;
    }> = [];

    for (const [email, item] of seen) {
      if (existingEmails.has(email)) continue;
      toCreate.push({
        listId,
        email,
        firstName: this.requiredString(item.firstName, 'firstName'),
        lastName: this.requiredString(item.lastName, 'lastName'),
        companyName: this.optionalString(item.companyName),
        jobTitle: this.optionalString(item.jobTitle),
        customVar1: this.optionalString(item.customVar1),
        customVar2: this.optionalString(item.customVar2),
        customVar3: this.optionalString(item.customVar3),
        customVar4: this.optionalString(item.customVar4),
        customVar5: this.optionalString(item.customVar5),
      });
    }

    let created = 0;
    if (toCreate.length > 0) {
      const result = await this.prisma.coldProspect.createMany({ data: toCreate, skipDuplicates: true });
      created = result.count;
    }

    // Update list counts
    const counts = await this.prisma.coldProspect.groupBy({
      by: ['validationStatus'],
      where: { listId },
      _count: true,
    });

    const totalCount = counts.reduce((sum: number, c: { _count: number }) => sum + c._count, 0);
    const validCount = counts.find((c: { validationStatus: string }) => c.validationStatus === 'valid')?._count ?? 0;
    const invalidCount = counts.find((c: { validationStatus: string }) => c.validationStatus === 'invalid')?._count ?? 0;
    const riskyCount = counts.find((c: { validationStatus: string }) => c.validationStatus === 'risky')?._count ?? 0;

    await this.prisma.coldProspectList.update({
      where: { id: listId },
      data: { totalCount, validCount, invalidCount, riskyCount },
    });

    return {
      created,
      skipped: seen.size - created,
      totalCount,
    };
  }

  async listProspects(tenantId: string, listId: string, query: Record<string, string>) {
    await this.ensureProspectList(tenantId, listId);

    const [data, total] = await Promise.all([
      this.prisma.coldProspect.findMany({
        where: { listId },
        orderBy: { createdAt: 'desc' },
        ...this.page(query),
      }),
      this.prisma.coldProspect.count({ where: { listId } }),
    ]);

    return { data, total, ...this.pageMeta(query, total) };
  }

  // ---------------------------------------------------------------------------
  // Cold Campaigns
  // ---------------------------------------------------------------------------

  listCampaigns(tenantId: string, query: Record<string, string>) {
    return this.prisma.coldCampaign.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status as ColdCampaignStatus } : {}),
      },
      orderBy: { createdAt: 'desc' },
      ...this.page(query),
    });
  }

  createCampaign(tenantId: string, userId: string, body: Record<string, unknown>) {
    return this.prisma.coldCampaign.create({
      data: {
        tenantId,
        createdBy: userId,
        name: this.requiredString(body.name, 'name'),
        goal: this.optionalString(body.goal),
        listId: this.optionalString(body.listId),
        stopOnReply: this.optionalBoolean(body.stopOnReply, true),
        stopOnUnsubscribe: this.optionalBoolean(body.stopOnUnsubscribe, true),
        trackOpens: this.optionalBoolean(body.trackOpens, false),
        trackClicks: this.optionalBoolean(body.trackClicks, false),
        trackingDomain: this.optionalString(body.trackingDomain),
      },
    });
  }

  async getCampaign(tenantId: string, id: string) {
    const campaign = await this.prisma.coldCampaign.findFirst({
      where: { tenantId, id },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
        mailboxes: { include: { mailbox: true } },
        prospectList: true,
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async updateCampaign(tenantId: string, id: string, body: Record<string, unknown>) {
    await this.ensureCampaign(tenantId, id);
    return this.prisma.coldCampaign.update({
      where: { id },
      data: {
        name: this.optionalString(body.name),
        goal: this.optionalString(body.goal),
        listId: this.optionalString(body.listId),
        stopOnReply: this.optionalBoolean(body.stopOnReply),
        stopOnUnsubscribe: this.optionalBoolean(body.stopOnUnsubscribe),
        trackOpens: this.optionalBoolean(body.trackOpens),
        trackClicks: this.optionalBoolean(body.trackClicks),
        trackingDomain: this.optionalString(body.trackingDomain),
      },
    });
  }

  async deleteCampaign(tenantId: string, id: string) {
    await this.ensureCampaign(tenantId, id);
    await this.prisma.coldCampaign.delete({ where: { id } });
    return { success: true };
  }

  async setSequenceSteps(tenantId: string, campaignId: string, body: Record<string, unknown>) {
    const campaign = await this.ensureCampaign(tenantId, campaignId);
    if (campaign.status === ColdCampaignStatus.active) {
      throw new BadRequestException('Cannot modify steps while campaign is active');
    }

    const steps = body.steps;
    if (!Array.isArray(steps) || steps.length === 0) {
      throw new BadRequestException('steps array is required and must not be empty');
    }

    const stepsData = steps.map((s, index) => {
      if (!s || typeof s !== 'object') throw new BadRequestException('Each step must be an object');
      const item = s as Record<string, unknown>;
      return {
        campaignId,
        stepOrder: this.optionalNumber(item.stepOrder, index + 1) ?? index + 1,
        subject: this.optionalString(item.subject),
        body: this.requiredString(item.body, 'body'),
        delayDays: this.optionalNumber(item.delayDays, 2) ?? 2,
        useThreading: this.optionalBoolean(item.useThreading, true),
      };
    });

    await this.prisma.$transaction([
      this.prisma.coldSequenceStep.deleteMany({ where: { campaignId } }),
      this.prisma.coldSequenceStep.createMany({ data: stepsData }),
    ]);

    return this.prisma.coldSequenceStep.findMany({
      where: { campaignId },
      orderBy: { stepOrder: 'asc' },
    });
  }

  async setCampaignMailboxes(tenantId: string, campaignId: string, body: Record<string, unknown>) {
    await this.ensureCampaign(tenantId, campaignId);

    const rawIds = body.mailboxIds;
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      throw new BadRequestException('mailboxIds array is required and must not be empty');
    }
    const mailboxIds: string[] = rawIds.map((id: unknown) => {
      if (typeof id !== 'string') throw new BadRequestException('Each mailbox ID must be a string');
      return id;
    });

    // Verify all mailboxes belong to tenant
    const mailboxes = await this.prisma.coldMailbox.findMany({
      where: { tenantId, id: { in: mailboxIds } },
    });
    if (mailboxes.length !== mailboxIds.length) {
      throw new BadRequestException('One or more mailbox IDs are invalid');
    }

    const data = mailboxIds.map((mailboxId: string) => ({
      campaignId,
      mailboxId,
    }));

    await this.prisma.$transaction([
      this.prisma.coldCampaignMailbox.deleteMany({ where: { campaignId } }),
      this.prisma.coldCampaignMailbox.createMany({ data }),
    ]);

    return this.prisma.coldCampaignMailbox.findMany({
      where: { campaignId },
      include: { mailbox: true },
    });
  }

  async activateCampaign(tenantId: string, id: string) {
    const campaign = await this.ensureCampaign(tenantId, id);

    if (campaign.status === ColdCampaignStatus.active) {
      throw new BadRequestException('Campaign is already active');
    }

    // Validate: must have at least 1 step
    const stepCount = await this.prisma.coldSequenceStep.count({ where: { campaignId: id } });
    if (stepCount === 0) {
      throw new BadRequestException('Campaign must have at least one sequence step');
    }

    // Validate: must have at least 1 mailbox
    const mailboxCount = await this.prisma.coldCampaignMailbox.count({ where: { campaignId: id } });
    if (mailboxCount === 0) {
      throw new BadRequestException('Campaign must have at least one mailbox assigned');
    }

    // Validate: must have a prospect list with valid prospects
    if (!campaign.listId) {
      throw new BadRequestException('Campaign must have a prospect list assigned');
    }

    const suppressed = await this.prisma.suppressionEntry.findMany({ where: { tenantId }, select: { email: true } });
    const suppressedEmails = new Set(suppressed.map((item) => item.email.toLowerCase()));
    const prospects = await this.prisma.coldProspect.findMany({
      where: {
        listId: campaign.listId,
        validationStatus: { not: 'invalid' },
      },
    });
    const eligibleProspects = prospects.filter((prospect) => !suppressedEmails.has(prospect.email.toLowerCase()));
    const prospectCount = eligibleProspects.length;
    if (prospectCount === 0) {
      throw new BadRequestException('Prospect list must contain at least one non-invalid prospect');
    }

    const mailboxes = await this.prisma.coldCampaignMailbox.findMany({
      where: { campaignId: id },
      include: { mailbox: true },
    });
    const readyMailboxes = mailboxes.filter(({ mailbox }) =>
      mailbox.status === MailboxStatus.active &&
      (!mailbox.warmupEnabled || mailbox.warmupStatus === WarmupStatus.ready) &&
      mailbox.sentToday < mailbox.dailySendLimit
    );
    if (!readyMailboxes.length) throw new BadRequestException('Campaign requires at least one active, warmed mailbox with daily capacity');

    const steps = await this.prisma.coldSequenceStep.findMany({ where: { campaignId: id }, orderBy: { stepOrder: 'asc' } });
    const firstStep = steps[0];
    await this.prisma.coldSequenceState.createMany({
      data: eligibleProspects.map((prospect) => ({
        campaignId: id,
        prospectId: prospect.id,
        currentStepId: firstStep.id,
        nextSendAfter: new Date(),
      })),
      skipDuplicates: true,
    });

    await this.jobs.enqueue({
      tenantId,
      queue: 'cold-email-sequences',
      name: 'cold_email.sequence.tick',
      payload: { campaignId: id },
    });

    return this.prisma.coldCampaign.update({
      where: { id },
      data: {
        status: ColdCampaignStatus.active,
        totalProspects: prospectCount,
      },
    });
  }

  async sendEngineState(tenantId: string, campaignId: string) {
    await this.ensureCampaign(tenantId, campaignId);
    const [states, logs, jobs] = await Promise.all([
      this.prisma.coldSequenceState.groupBy({ by: ['status'], where: { campaignId }, _count: true }),
      this.prisma.sendingLog.findMany({ where: { campaignId }, orderBy: { sentAt: 'desc' }, take: 100 }),
      this.prisma.jobLog.findMany({ where: { tenantId, queue: 'cold-email-sequences' }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    return { states, logs, jobs };
  }

  async ingestEvent(tenantId: string, campaignId: string, body: Record<string, unknown>) {
    await this.ensureCampaign(tenantId, campaignId);
    const type = this.requiredString(body.type, 'type');
    const prospectId = this.optionalString(body.prospectId);
    const event = await this.prisma.coldEmailEvent.create({
      data: {
        campaignId,
        prospectId,
        stepOrder: this.optionalNumber(body.stepOrder),
        type,
        metadata: body.metadata as never,
      },
    });

    if (prospectId && ['reply', 'positive_reply'].includes(type)) {
      await this.prisma.coldSequenceState.updateMany({
        where: { campaignId, prospectId },
        data: { status: type === 'positive_reply' ? 'interested' : 'replied', completedAt: new Date() },
      });
    }
    if (prospectId && ['bounce', 'unsubscribe'].includes(type)) {
      const prospect = await this.prisma.coldProspect.findUnique({ where: { id: prospectId } });
      if (prospect) {
        await this.prisma.suppressionEntry.upsert({
          where: { tenantId_email: { tenantId, email: prospect.email.toLowerCase() } },
          create: { tenantId, email: prospect.email.toLowerCase(), source: type === 'bounce' ? 'bounce' : 'unsubscribe', reason: `Cold outreach ${type}` },
          update: { source: type === 'bounce' ? 'bounce' : 'unsubscribe', reason: `Cold outreach ${type}` },
        });
        await this.prisma.coldSequenceState.updateMany({
          where: { campaignId, prospectId },
          data: { status: type === 'bounce' ? 'bounced' : 'unsubscribed', completedAt: new Date() },
        });
      }
    }
    return event;
  }

  async pauseCampaign(tenantId: string, id: string) {
    const campaign = await this.ensureCampaign(tenantId, id);
    if (campaign.status !== ColdCampaignStatus.active) {
      throw new BadRequestException('Only active campaigns can be paused');
    }
    return this.prisma.coldCampaign.update({
      where: { id },
      data: { status: ColdCampaignStatus.paused },
    });
  }

  async getCampaignAnalytics(tenantId: string, id: string) {
    const campaign = await this.ensureCampaign(tenantId, id);

    const events = await this.prisma.coldEmailEvent.groupBy({
      by: ['type'],
      where: { campaignId: id },
      _count: true,
    });

    const eventMap: Record<string, number> = {};
    for (const e of events) {
      eventMap[e.type] = e._count;
    }

    const statesByStatus = await this.prisma.coldSequenceState.groupBy({
      by: ['status'],
      where: { campaignId: id },
      _count: true,
    });

    const statusMap: Record<string, number> = {};
    for (const s of statesByStatus) {
      statusMap[s.status] = s._count;
    }

    return {
      campaignId: id,
      name: campaign.name,
      status: campaign.status,
      totalProspects: campaign.totalProspects,
      sentCount: campaign.sentCount,
      openCount: campaign.openCount,
      replyCount: campaign.replyCount,
      positiveReplyCount: campaign.positiveReplyCount,
      bounceCount: campaign.bounceCount,
      unsubCount: campaign.unsubCount,
      openRate: campaign.sentCount > 0 ? Math.round((campaign.openCount / campaign.sentCount) * 10000) / 100 : 0,
      replyRate: campaign.sentCount > 0 ? Math.round((campaign.replyCount / campaign.sentCount) * 10000) / 100 : 0,
      bounceRate: campaign.sentCount > 0 ? Math.round((campaign.bounceCount / campaign.sentCount) * 10000) / 100 : 0,
      bounceRateExceeded: this.isBounceRateExceeded(campaign.bounceCount, campaign.sentCount),
      eventBreakdown: eventMap,
      prospectStatusBreakdown: statusMap,
    };
  }

  // ---------------------------------------------------------------------------
  // Bounce Rate Check
  // ---------------------------------------------------------------------------

  isBounceRateExceeded(bounceCount: number, sentCount: number): boolean {
    if (sentCount === 0) return false;
    return (bounceCount / sentCount) * 100 > 5;
  }

  // ---------------------------------------------------------------------------
  // Ensure helpers (tenant-scoped lookups)
  // ---------------------------------------------------------------------------

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

  private async ensureMailbox(tenantId: string, id: string) {
    const mailbox = await this.prisma.coldMailbox.findFirst({ where: { tenantId, id } });
    if (!mailbox) throw new NotFoundException('Mailbox not found');
    return mailbox;
  }

  private async ensureProspectList(tenantId: string, listId: string) {
    const list = await this.prisma.coldProspectList.findFirst({ where: { tenantId, id: listId } });
    if (!list) throw new NotFoundException('Prospect list not found');
    return list;
  }

  private async ensureCampaign(tenantId: string, id: string) {
    const campaign = await this.prisma.coldCampaign.findFirst({ where: { tenantId, id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  // ---------------------------------------------------------------------------
  // Shared helpers (same pattern as EmailService)
  // ---------------------------------------------------------------------------

  private page(query: Record<string, string>) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 50), 1), 100);
    return { skip: (page - 1) * pageSize, take: pageSize };
  }

  private pageMeta(query: Record<string, string>, total: number) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 50), 1), 100);
    return { page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  private requiredString(value: unknown, field: string) {
    if (typeof value !== 'string' || value.trim().length === 0) throw new BadRequestException(`${field} is required`);
    return value.trim();
  }

  private requiredEnum<T extends string>(value: unknown, allowed: T[], field: string) {
    if (typeof value !== 'string' || value.trim().length === 0) throw new BadRequestException(`${field} is required`);
    if (!allowed.includes(value as T)) throw new BadRequestException(`${field} must be one of: ${allowed.join(', ')}`);
    return value as T;
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

  private optionalBoolean(value: unknown, fallback?: boolean) {
    if (value === undefined || value === null) return fallback;
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

  // ---------------------------------------------------------------------------
  // Bulk Domain Add (Gap 4)
  // ---------------------------------------------------------------------------

  async bulkAddDomains(tenantId: string, body: Record<string, unknown>) {
    const domains = Array.isArray(body.domains) ? body.domains : [];
    if (domains.length === 0) throw new BadRequestException('domains array is required');

    const results: Array<{ domain: string; status: string; id?: string }> = [];
    for (const raw of domains) {
      const domain = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
      if (!domain || !domain.includes('.')) { results.push({ domain: String(raw), status: 'invalid' }); continue; }
      const existing = await this.prisma.sendingDomain.findFirst({ where: { tenantId, domain } });
      if (existing) { results.push({ domain, status: 'duplicate', id: existing.id }); continue; }
      const created = await this.prisma.sendingDomain.create({
        data: { tenantId, domain, spfStatus: DnsRecordStatus.not_set, dkimStatus: DnsRecordStatus.not_set, dmarcStatus: DnsRecordStatus.not_set, mxStatus: DnsRecordStatus.not_set },
      });
      results.push({ domain, status: 'created', id: created.id });
    }
    return { total: domains.length, created: results.filter((r) => r.status === 'created').length, duplicates: results.filter((r) => r.status === 'duplicate').length, results };
  }

  // ---------------------------------------------------------------------------
  // Test Send (Gap 7)
  // ---------------------------------------------------------------------------

  async testSend(tenantId: string, campaignId: string, body: Record<string, unknown>) {
    const email = this.requiredString(body.email, 'email');
    const stepIndex = this.optionalNumber(body.stepIndex, 0) ?? 0;
    const campaign = await this.ensureCampaign(tenantId, campaignId);
    const steps = await this.prisma.coldSequenceStep.findMany({ where: { campaignId }, orderBy: { stepOrder: 'asc' } });
    if (steps.length === 0) throw new BadRequestException('Campaign has no steps');
    const step = steps[stepIndex] ?? steps[0];

    const subject = (step.subject ?? '')
      .replace(/\{\{firstName\}\}/g, 'Test').replace(/\{\{first_name\}\}/g, 'Test')
      .replace(/\{\{lastName\}\}/g, 'User').replace(/\{\{last_name\}\}/g, 'User')
      .replace(/\{\{company\}\}/g, 'Test Company').replace(/\{\{jobTitle\}\}/g, 'CEO').replace(/\{\{job_title\}\}/g, 'CEO')
      .replace(/\{\{email\}\}/g, email);
    const html = step.body
      .replace(/\{\{firstName\}\}/g, 'Test').replace(/\{\{first_name\}\}/g, 'Test')
      .replace(/\{\{lastName\}\}/g, 'User').replace(/\{\{last_name\}\}/g, 'User')
      .replace(/\{\{company\}\}/g, 'Test Company').replace(/\{\{jobTitle\}\}/g, 'CEO').replace(/\{\{job_title\}\}/g, 'CEO')
      .replace(/\{\{email\}\}/g, email);

    const mailboxes = await this.prisma.coldCampaignMailbox.findMany({ where: { campaignId }, include: { mailbox: true } });
    const fromEmail = mailboxes[0]?.mailbox?.email ?? 'test@example.com';
    const fromName = mailboxes[0]?.mailbox?.fromName ?? 'Test Sender';

    await this.emailDelivery.send({ tenantId, to: email, fromEmail, fromName, subject, html });
    return { sent: true, to: email, subject };
  }

  // ---------------------------------------------------------------------------
  // Duplicate Campaign (Gap 8)
  // ---------------------------------------------------------------------------

  async duplicateCampaign(tenantId: string, campaignId: string) {
    const campaign = await this.prisma.coldCampaign.findFirst({
      where: { tenantId, id: campaignId },
      include: { steps: { orderBy: { stepOrder: 'asc' } }, mailboxes: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const copy = await this.prisma.coldCampaign.create({
      data: {
        tenantId, name: `${campaign.name} (copy)`, goal: campaign.goal, listId: campaign.listId,
        status: 'draft', stopOnReply: campaign.stopOnReply, stopOnUnsubscribe: campaign.stopOnUnsubscribe,
        trackOpens: campaign.trackOpens, trackClicks: campaign.trackClicks, trackingDomain: campaign.trackingDomain,
        totalProspects: 0, sentCount: 0, openCount: 0, replyCount: 0, positiveReplyCount: 0, bounceCount: 0, unsubCount: 0,
        createdBy: campaign.createdBy,
        steps: { create: campaign.steps.map((s) => ({ stepOrder: s.stepOrder, subject: s.subject, body: s.body, delayDays: s.delayDays, useThreading: s.useThreading })) },
        mailboxes: { create: campaign.mailboxes.map((m) => ({ mailboxId: m.mailboxId })) },
      },
      include: { steps: true, mailboxes: { include: { mailbox: true } } },
    });
    return copy;
  }

  // ---------------------------------------------------------------------------
  // SMTP Connection Test (Gap 10)
  // ---------------------------------------------------------------------------

  async testSmtpConnection(body: Record<string, unknown>) {
    const host = this.requiredString(body.host, 'host');
    const port = this.optionalNumber(body.port, 587) ?? 587;

    return new Promise<{ success: boolean; banner?: string; error?: string }>((resolve) => {
      const socket = net.createConnection({ host, port, timeout: 10000 }, () => {
        socket.once('data', (data) => {
          const banner = data.toString().trim();
          socket.end();
          resolve({ success: true, banner });
        });
      });
      socket.on('error', (err) => { resolve({ success: false, error: err.message }); });
      socket.on('timeout', () => { socket.destroy(); resolve({ success: false, error: 'Connection timed out' }); });
    });
  }

  // ---------------------------------------------------------------------------
  // SendGrid Webhook Handler (Gap 3)
  // ---------------------------------------------------------------------------

  async handleSendGridWebhook(rawBody: unknown) {
    const events = Array.isArray(rawBody) ? rawBody : [];
    let processed = 0;

    const typeMap: Record<string, string> = {
      delivered: 'delivered', open: 'opened', click: 'clicked',
      bounce: 'bounce', dropped: 'bounce', deferred: 'deferred',
      unsubscribe: 'unsubscribe', group_unsubscribe: 'unsubscribe',
      spamreport: 'spam',
    };

    for (const event of events) {
      const sgType = event?.event as string | undefined;
      const mappedType = sgType ? typeMap[sgType] : undefined;
      if (!mappedType) continue;

      const customArgs = event?.custom_args ?? event ?? {};
      const campaignId = customArgs.campaignId as string | undefined;
      const prospectId = (customArgs.recipientId ?? customArgs.prospect_id) as string | undefined;
      if (!campaignId) continue;

      const campaign = await this.prisma.coldCampaign.findUnique({ where: { id: campaignId } });
      if (!campaign) continue;

      await this.prisma.coldEmailEvent.create({
        data: { campaignId, prospectId: prospectId ?? '', type: mappedType, metadata: event as any },
      }).catch(() => undefined);

      const counterUpdate: Record<string, any> = {};
      if (mappedType === 'opened') counterUpdate.openCount = { increment: 1 };
      if (mappedType === 'bounce') counterUpdate.bounceCount = { increment: 1 };
      if (mappedType === 'unsubscribe') counterUpdate.unsubCount = { increment: 1 };
      if (Object.keys(counterUpdate).length > 0) {
        await this.prisma.coldCampaign.update({ where: { id: campaignId }, data: counterUpdate }).catch(() => undefined);
      }

      if (prospectId && (mappedType === 'bounce' || mappedType === 'unsubscribe')) {
        const prospect = await this.prisma.coldProspect.findUnique({ where: { id: prospectId } });
        if (prospect && campaign.tenantId) {
          await this.prisma.suppressionEntry.upsert({
            where: { tenantId_email: { tenantId: campaign.tenantId, email: prospect.email } },
            update: { source: mappedType === 'bounce' ? 'bounce' : 'unsubscribe' },
            create: { tenantId: campaign.tenantId, email: prospect.email, source: mappedType === 'bounce' ? 'bounce' : 'unsubscribe' },
          }).catch(() => undefined);
          await this.prisma.coldSequenceState.updateMany({
            where: { campaignId, prospectId, status: { in: ['queued', 'active'] } },
            data: { status: mappedType === 'bounce' ? 'bounced' : 'unsubscribed', completedAt: new Date() },
          });
        }
      }

      processed++;
    }

    return { processed };
  }

  // ---------------------------------------------------------------------------
  // Prospect Email Validation via MX (Gap 12)
  // ---------------------------------------------------------------------------

  async validateProspectEmails(prospectIds: string[]) {
    if (prospectIds.length === 0) return;
    const prospects = await this.prisma.coldProspect.findMany({ where: { id: { in: prospectIds } } });
    const domainMap = new Map<string, string[]>();
    for (const p of prospects) {
      const domain = p.email.split('@')[1]?.toLowerCase();
      if (!domain) continue;
      if (!domainMap.has(domain)) domainMap.set(domain, []);
      domainMap.get(domain)!.push(p.id);
    }

    for (const [domain, ids] of domainMap) {
      try {
        const records = await new Promise<dns.MxRecord[]>((resolve, reject) => {
          dns.resolveMx(domain, (err, addresses) => err ? reject(err) : resolve(addresses));
        });
        const status = records && records.length > 0 ? 'valid' : 'risky';
        await this.prisma.coldProspect.updateMany({ where: { id: { in: ids } }, data: { validationStatus: status } });
      } catch {
        await this.prisma.coldProspect.updateMany({ where: { id: { in: ids } }, data: { validationStatus: 'invalid' } });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Email Finder — Credential Management
  // ---------------------------------------------------------------------------

  async saveEmailFinderCredential(tenantId: string, body: Record<string, unknown>) {
    const apiKey = this.requiredString(body.apiKey, 'apiKey');
    const providerType = typeof body.providerType === 'string' ? body.providerType : 'apollo';
    const encrypted = this.encryption.encrypt(apiKey);
    const credential = await this.prisma.emailFinderCredential.upsert({
      where: { tenantId_providerType: { tenantId, providerType } },
      update: { apiKeyCipher: encrypted, isActive: true, connectedAt: new Date() },
      create: { tenantId, providerType, apiKeyCipher: encrypted, isActive: true },
    });
    return { id: credential.id, providerType, isActive: true, connectedAt: credential.connectedAt };
  }

  async getEmailFinderCredential(tenantId: string) {
    const credential = await this.prisma.emailFinderCredential.findFirst({ where: { tenantId } });
    if (!credential) return null;
    return {
      id: credential.id,
      providerType: credential.providerType,
      isActive: credential.isActive,
      connectedAt: credential.connectedAt,
      lastUsedAt: credential.lastUsedAt,
      maskedKey: '****' + this.encryption.decrypt(credential.apiKeyCipher).slice(-4),
    };
  }

  async deleteEmailFinderCredential(tenantId: string) {
    await this.prisma.emailFinderCredential.deleteMany({ where: { tenantId } });
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Email Finder — Apollo.io Search
  // ---------------------------------------------------------------------------

  async searchEmailFinder(tenantId: string, body: Record<string, unknown>) {
    const credential = await this.prisma.emailFinderCredential.findFirst({ where: { tenantId, isActive: true } });
    if (!credential) throw new BadRequestException('No email finder API key configured. Go to Settings > Integrations to add one.');
    const apiKey = this.encryption.decrypt(credential.apiKeyCipher);

    const titles = typeof body.titles === 'string' ? body.titles.split(',').map((t: string) => t.trim()).filter(Boolean) : Array.isArray(body.titles) ? body.titles : [];
    const domain = this.optionalString(body.domain);
    const companyName = this.optionalString(body.companyName);
    const locations = typeof body.locations === 'string' ? body.locations.split(',').map((l: string) => l.trim()).filter(Boolean) : Array.isArray(body.locations) ? body.locations : [];
    const perPage = this.optionalNumber(body.perPage, 25) ?? 25;

    const searchBody: Record<string, unknown> = { per_page: Math.min(perPage, 100) };
    if (titles.length > 0) searchBody.person_titles = titles;
    if (domain) searchBody.q_organization_domains = domain;
    if (companyName) searchBody.q_organization_name = companyName;
    if (locations.length > 0) searchBody.person_locations = locations;

    try {
      const response = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify(searchBody),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new BadRequestException(`Apollo API error: ${response.status} ${errorText.slice(0, 200)}`);
      }
      const data = await response.json();
      await this.prisma.emailFinderCredential.update({ where: { id: credential.id }, data: { lastUsedAt: new Date() } });
      await this.prisma.providerLog.create({
        data: { tenantId, provider: 'apollo', operation: 'people_search', status: 'success', request: searchBody as any, response: { count: data.people?.length ?? 0 } },
      }).catch(() => undefined);

      const results = (data.people ?? []).map((p: any) => ({
        firstName: p.first_name ?? '',
        lastName: p.last_name ?? '',
        email: p.email ?? null,
        title: p.title ?? '',
        companyName: p.organization?.name ?? '',
        emailStatus: p.email_status ?? 'unavailable',
        linkedinUrl: p.linkedin_url ?? null,
        city: p.city ?? null,
        country: p.country ?? null,
      }));

      return { results, totalCount: data.pagination?.total_entries ?? results.length };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      await this.prisma.providerLog.create({
        data: { tenantId, provider: 'apollo', operation: 'people_search', status: 'failed', request: searchBody as any, error: error instanceof Error ? error.message : String(error) },
      }).catch(() => undefined);
      throw new BadRequestException(`Email finder search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Email Finder — Save Results
  // ---------------------------------------------------------------------------

  async saveEmailFinderResultsToProspectList(tenantId: string, userId: string, body: Record<string, unknown>) {
    const prospects = Array.isArray(body.prospects) ? body.prospects : [];
    if (prospects.length === 0) throw new BadRequestException('No prospects to save');

    let listId = this.optionalString(body.listId);
    const newListName = this.optionalString(body.newListName);
    if (!listId && newListName) {
      const newList = await this.prisma.coldProspectList.create({ data: { tenantId, name: newListName, createdBy: userId } });
      listId = newList.id;
    }
    if (!listId) throw new BadRequestException('Either listId or newListName is required');

    return this.bulkAddProspects(tenantId, listId, { prospects });
  }

  async saveEmailFinderResultsToCrm(tenantId: string, userId: string, body: Record<string, unknown>) {
    const prospects = Array.isArray(body.prospects) ? body.prospects : [];
    if (prospects.length === 0) throw new BadRequestException('No prospects to save');
    let created = 0;
    let skipped = 0;

    for (const p of prospects) {
      const email = typeof p.email === 'string' ? p.email.trim() : '';
      if (!email) { skipped++; continue; }
      const firstName = typeof p.firstName === 'string' ? p.firstName.trim() : 'Unknown';
      const lastName = typeof p.lastName === 'string' ? p.lastName.trim() : '';
      const companyName = typeof p.companyName === 'string' ? p.companyName.trim() : undefined;
      const jobTitle = typeof p.title === 'string' ? p.title.trim() : typeof p.jobTitle === 'string' ? p.jobTitle.trim() : undefined;

      const existing = await this.prisma.contact.findFirst({ where: { tenantId, email } });
      if (existing) { skipped++; continue; }

      let companyId: string | undefined;
      if (companyName) {
        let company = await this.prisma.company.findFirst({ where: { tenantId, name: companyName } });
        if (!company) {
          company = await this.prisma.company.create({ data: { tenantId, name: companyName } });
        }
        companyId = company.id;
      }

      await this.prisma.contact.create({
        data: { tenantId, email, firstName, lastName, jobTitle, companyId, source: 'api' },
      });
      created++;
    }

    return { created, skipped };
  }
}
