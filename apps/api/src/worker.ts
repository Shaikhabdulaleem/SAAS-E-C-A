import 'reflect-metadata';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { CampaignStatus, EmailEventType, JobStatus, PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('REDIS_URL is required to run workers');
}

const prisma = new PrismaClient();
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

async function processEmailCampaign(data: Record<string, unknown>) {
  const payload = (data.payload && typeof data.payload === 'object') ? data.payload as Record<string, unknown> : data;
  const campaignId = payload.campaignId as string | undefined;
  if (!campaignId) return { skipped: true, reason: 'no campaignId' };
  const campaign = await prisma.emailCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return { skipped: true, reason: 'campaign not found' };
  if (campaign.status === CampaignStatus.cancelled) return { skipped: true, reason: 'campaign cancelled' };

  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: { status: CampaignStatus.sending, lastError: null },
  });

  const recipients = await prisma.campaignRecipient.findMany({
    where: { campaignId, status: 'queued' },
    take: Math.max(campaign.dailySendLimit ?? 5000, 1),
  });
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const latest = await prisma.emailCampaign.findUnique({ where: { id: campaignId }, select: { status: true } });
    if (latest?.status === CampaignStatus.cancelled) break;
    try {
      const html = await withTracking(campaign.body, campaign.tenantId, campaign.id, recipient.id, recipient.email, campaign.trackOpens, campaign.trackClicks);
      const requestId = await sendViaSendGrid({
        tenantId: campaign.tenantId,
        campaignId: campaign.id,
        recipientId: recipient.id,
        to: recipient.email,
        fromEmail: campaign.fromEmail,
        fromName: campaign.fromName,
        subject: campaign.subject,
        html,
        text: campaign.bodyPlainText,
        replyTo: campaign.replyToEmail,
      });
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: 'sent', sentAt: new Date(), attempts: { increment: 1 }, providerRequestId: requestId, lastError: null },
      });
      await prisma.emailEvent.create({
        data: {
          campaignId: campaign.id,
          recipientId: recipient.id,
          type: EmailEventType.delivered,
          providerId: requestId,
          eventKey: requestId ? `sendgrid:${requestId}` : `local:${recipient.id}:delivered`,
        },
      }).catch(() => undefined);
      sent++;
    } catch (error) {
      failed++;
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: recipient.attempts + 1 >= 3 ? 'failed' : 'queued',
          attempts: { increment: 1 },
          failedAt: new Date(),
          lastError: error instanceof Error ? error.message : String(error),
        },
      });
      await prisma.providerLog.create({
        data: {
          tenantId: campaign.tenantId,
          provider: 'sendgrid',
          operation: 'send_email',
          status: 'failed',
          request: { to: recipient.email, campaignId: campaign.id },
          error: error instanceof Error ? error.message : String(error),
        },
      }).catch(() => undefined);
    }
  }

  const remaining = await prisma.campaignRecipient.count({ where: { campaignId, status: 'queued' } });
  const permanentFailures = await prisma.campaignRecipient.count({ where: { campaignId, status: 'failed' } });
  const nextStatus = remaining > 0
    ? CampaignStatus.sending
    : permanentFailures > 0
      ? CampaignStatus.partial_failed
      : CampaignStatus.sent;

  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: nextStatus,
      sentAt: nextStatus === CampaignStatus.sent || nextStatus === CampaignStatus.partial_failed ? new Date() : undefined,
      completedAt: nextStatus === CampaignStatus.sent || nextStatus === CampaignStatus.partial_failed ? new Date() : undefined,
      lastError: permanentFailures > 0 ? `${permanentFailures} recipients failed` : null,
    },
  });

  return { processed: true, sent, failed, remaining };
}

async function processColdSequenceTick(data: Record<string, unknown>) {
  const campaignId = data.campaignId as string | undefined;
  if (!campaignId) return { skipped: true };
  const campaign = await prisma.coldCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== 'active') return { skipped: true, reason: 'campaign not active' };
  const pendingStates = await prisma.coldSequenceState.findMany({
    where: { campaignId, status: 'queued', nextSendAfter: { lte: new Date() } },
    take: 100,
  });
  return { processed: true, pendingCount: pendingStates.length };
}

async function processNotification(data: Record<string, unknown>) {
  const payload = data.payload as Record<string, unknown> | undefined;
  if (!payload) return { skipped: true };
  return { processed: true, type: data.name };
}

async function processDnsCheck(data: Record<string, unknown>) {
  const payload = data.payload as Record<string, unknown> | undefined;
  const domainId = (payload?.domainId ?? '') as string;
  if (!domainId) return { skipped: true };
  const domain = await prisma.sendingDomain.findUnique({ where: { id: domainId } });
  if (!domain) return { skipped: true, reason: 'domain not found' };
  return { processed: true, domain: domain.domain };
}

const handlers: Record<string, (data: Record<string, unknown>) => Promise<Record<string, unknown>>> = {
  'email-campaigns': processEmailCampaign,
  'cold-email-sequences': processColdSequenceTick,
  'notifications': processNotification,
  'dns-checks': processDnsCheck,
};

const queues = [
  'email-campaigns',
  'cold-email-sequences',
  'mailbox-warmup',
  'provider-sync',
  'dns-checks',
  'notifications',
  'external-api',
];

for (const queueName of queues) {
  new Worker(queueName, async (job) => {
    const jobLogId = job.data?.jobLogId as string | undefined;
    if (jobLogId) {
      await prisma.jobLog.update({
        where: { id: jobLogId },
        data: { status: JobStatus.running, attempts: { increment: 1 }, startedAt: new Date() },
      });
    }

    let result: Record<string, unknown> = { processed: true, queueName };
    try {
      const handler = handlers[queueName];
      if (handler) {
        result = await handler(job.data ?? {});
      }

      if (jobLogId) {
        await prisma.jobLog.update({
          where: { id: jobLogId },
          data: { status: JobStatus.completed, completedAt: new Date() },
        });
      }
    } catch (error) {
      if (jobLogId) {
        await prisma.jobLog.update({
          where: { id: jobLogId },
          data: {
            status: JobStatus.failed,
            completedAt: new Date(),
            lastError: error instanceof Error ? error.message : String(error),
          },
        });
      }
      throw error;
    }

    return result;
  }, { connection: connection as never });
}

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  await connection.quit();
  process.exit(0);
});

async function sendViaSendGrid(input: {
  tenantId: string;
  campaignId: string;
  recipientId: string;
  to: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  html?: string | null;
  text?: string | null;
  replyTo?: string | null;
}) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error('SENDGRID_API_KEY is not configured');
  const payload = {
    personalizations: [{
      to: [{ email: input.to }],
      custom_args: { tenantId: input.tenantId, campaignId: input.campaignId, recipientId: input.recipientId },
    }],
    from: { email: input.fromEmail, name: input.fromName },
    reply_to: input.replyTo ? { email: input.replyTo } : undefined,
    subject: input.subject,
    content: [
      ...(input.text ? [{ type: 'text/plain', value: input.text }] : []),
      ...(input.html ? [{ type: 'text/html', value: input.html }] : []),
    ],
    tracking_settings: {
      click_tracking: { enable: true, enable_text: true },
      open_tracking: { enable: true },
      subscription_tracking: { enable: false },
    },
  };
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const requestId = response.headers.get('x-message-id') ?? undefined;
  if (!response.ok) throw new Error(await response.text());
  await prisma.providerLog.create({
    data: {
      tenantId: input.tenantId,
      provider: 'sendgrid',
      operation: 'send_email',
      status: 'success',
      requestId,
      request: { to: input.to, campaignId: input.campaignId },
      response: { status: response.status },
    },
  }).catch(() => undefined);
  return requestId;
}

async function withTracking(body: string | null, tenantId: string, campaignId: string, recipientId: string, email: string, trackOpens: boolean, trackClicks: boolean) {
  if (!body) return body;
  const baseUrl = process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3001}/api`;
  const openToken = randomBytes(24).toString('base64url');
  await prisma.trackingEvent.create({
    data: { tenantId, campaignId, recipientId, email, type: 'token', token: openToken },
  }).catch(() => undefined);
  const unsubToken = randomBytes(32).toString('base64url');
  await prisma.unsubscribeToken.create({
    data: {
      tenantId,
      email,
      campaignId,
      tokenHash: hash(unsubToken),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
    },
  }).catch(() => undefined);
  const unsubUrl = `${baseUrl}/email/events/unsubscribe/${unsubToken}`;
  const linkedBody = trackClicks ? body.replace(/href=(["'])(https?:\/\/[^"']+)\1/gi, (_match, quote: string, url: string) => {
    const tracked = `${baseUrl}/email/events/click/${openToken}?url=${encodeURIComponent(url)}`;
    return `href=${quote}${tracked}${quote}`;
  }) : body;
  const openPixel = trackOpens ? `<img src="${baseUrl}/email/events/open/${openToken}" alt="" width="1" height="1" style="display:none" />` : '';
  return `${linkedBody}<div style="text-align:center;margin-top:20px;font-size:12px;color:#999;"><a href="${unsubUrl}" style="color:#999;">Unsubscribe</a></div>${openPixel}`;
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
