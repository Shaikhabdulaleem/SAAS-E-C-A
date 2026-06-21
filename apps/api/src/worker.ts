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
  const campaignId = (data.campaignId ?? (data.payload as any)?.campaignId) as string | undefined;
  if (!campaignId) return { skipped: true };
  const campaign = await prisma.coldCampaign.findUnique({
    where: { id: campaignId },
    include: {
      steps: { orderBy: { stepOrder: 'asc' } },
      mailboxes: { include: { mailbox: true } },
    },
  });
  if (!campaign || campaign.status !== 'active') return { skipped: true, reason: 'campaign not active' };
  if (campaign.steps.length === 0) return { skipped: true, reason: 'no steps' };

  const pendingStates = await prisma.coldSequenceState.findMany({
    where: {
      campaignId,
      status: { in: ['queued', 'active'] },
      nextSendAfter: { lte: new Date() },
    },
    include: { prospect: true },
    take: 50,
  });
  if (pendingStates.length === 0) return { processed: true, sent: 0 };

  const suppressedEmails = new Set(
    (await prisma.suppressionEntry.findMany({
      where: { tenantId: campaign.tenantId ?? undefined },
      select: { email: true },
    })).map((s) => s.email.toLowerCase()),
  );

  const activeMailboxes = campaign.mailboxes
    .map((m) => m.mailbox)
    .filter((mb) => mb.status === 'active' && mb.sentToday < mb.dailySendLimit);

  if (activeMailboxes.length === 0) return { processed: true, sent: 0, reason: 'no available mailboxes' };

  const now = new Date();
  const currentHour = now.getUTCHours();
  const sendableMailboxes = activeMailboxes.filter((mb) => {
    const start = parseInt(mb.sendWindowStart?.replace(':', '') ?? '0800', 10);
    const end = parseInt(mb.sendWindowEnd?.replace(':', '') ?? '1700', 10);
    const current = currentHour * 100;
    return current >= start && current <= end;
  });
  if (sendableMailboxes.length === 0) return { processed: true, sent: 0, reason: 'outside send window' };

  let mailboxIndex = 0;
  let sent = 0;
  let failed = 0;

  for (const state of pendingStates) {
    const prospect = state.prospect;
    if (!prospect) continue;
    if (suppressedEmails.has(prospect.email.toLowerCase())) {
      await prisma.coldSequenceState.update({ where: { id: state.id }, data: { status: 'completed', completedAt: now } });
      continue;
    }
    if (prospect.validationStatus === 'invalid') {
      await prisma.coldSequenceState.update({ where: { id: state.id }, data: { status: 'completed', completedAt: now } });
      continue;
    }

    const currentStep = campaign.steps.find((s) => s.id === state.currentStepId);
    if (!currentStep) {
      await prisma.coldSequenceState.update({ where: { id: state.id }, data: { status: 'completed', completedAt: now } });
      continue;
    }

    const mailbox = sendableMailboxes[mailboxIndex % sendableMailboxes.length];
    if (mailbox.sentToday >= mailbox.dailySendLimit) continue;
    mailboxIndex++;

    const renderTemplate = (text: string) =>
      text
        .replace(/\{\{firstName\}\}/g, prospect.firstName ?? '')
        .replace(/\{\{first_name\}\}/g, prospect.firstName ?? '')
        .replace(/\{\{lastName\}\}/g, prospect.lastName ?? '')
        .replace(/\{\{last_name\}\}/g, prospect.lastName ?? '')
        .replace(/\{\{company\}\}/g, prospect.companyName ?? '')
        .replace(/\{\{jobTitle\}\}/g, prospect.jobTitle ?? '')
        .replace(/\{\{job_title\}\}/g, prospect.jobTitle ?? '')
        .replace(/\{\{email\}\}/g, prospect.email);

    const subject = renderTemplate(currentStep.subject);
    let body = renderTemplate(currentStep.body);
    body = await withTracking(body, campaign.tenantId ?? '', campaignId, state.prospectId, prospect.email, campaign.trackOpens, campaign.trackClicks) ?? body;

    try {
      await sendViaSendGrid({
        tenantId: campaign.tenantId ?? '',
        campaignId,
        recipientId: state.prospectId,
        to: prospect.email,
        fromEmail: mailbox.email,
        fromName: mailbox.fromName ?? mailbox.email,
        subject,
        html: body,
        replyTo: mailbox.replyToEmail,
      });

      await prisma.coldEmailEvent.create({
        data: { campaignId, prospectId: state.prospectId, type: 'sent', stepOrder: currentStep.stepOrder, metadata: {} },
      }).catch(() => undefined);

      const persona = await prisma.persona.findFirst({ where: { mailboxId: mailbox.id } });
      if (persona) {
        await prisma.sendingLog.create({
          data: { personaId: persona.id, mailboxId: mailbox.id, campaignId, prospectId: state.prospectId, sentAt: now, status: 'sent' },
        }).catch(() => undefined);
      }

      const nextStep = campaign.steps.find((s) => s.stepOrder > currentStep.stepOrder);
      if (nextStep) {
        await prisma.coldSequenceState.update({
          where: { id: state.id },
          data: {
            currentStepId: nextStep.id,
            status: 'active',
            lastSentAt: now,
            nextSendAfter: new Date(now.getTime() + (nextStep.delayDays ?? 2) * 86400000),
          },
        });
      } else {
        await prisma.coldSequenceState.update({
          where: { id: state.id },
          data: { status: 'completed', lastSentAt: now, completedAt: now },
        });
      }

      await prisma.coldMailbox.update({ where: { id: mailbox.id }, data: { sentToday: { increment: 1 }, totalSent: { increment: 1 } } });
      mailbox.sentToday++;
      await prisma.coldCampaign.update({ where: { id: campaignId }, data: { sentCount: { increment: 1 } } });
      sent++;
    } catch (error) {
      failed++;
      await prisma.providerLog.create({
        data: {
          tenantId: campaign.tenantId ?? '',
          provider: 'sendgrid',
          operation: 'cold_email_send',
          status: 'failed',
          request: { to: prospect.email, campaignId },
          error: error instanceof Error ? error.message : String(error),
        },
      }).catch(() => undefined);
    }

    const delay = (mailbox.minDelaySeconds ?? 60) + Math.random() * ((mailbox.maxDelaySeconds ?? 180) - (mailbox.minDelaySeconds ?? 60));
    await new Promise((r) => setTimeout(r, delay * 1000));
  }

  const remaining = await prisma.coldSequenceState.count({
    where: { campaignId, status: { in: ['queued', 'active'] } },
  });
  if (remaining > 0) {
    const queue = new (await import('bullmq')).Queue('cold-email-sequences', { connection: connection as never });
    await queue.add('tick', { campaignId }, { delay: 180000 });
    await queue.close();
  } else {
    await prisma.coldCampaign.update({ where: { id: campaignId }, data: { status: 'completed' } });
  }

  return { processed: true, sent, failed, remaining };
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

async function processMailboxWarmup(data: Record<string, unknown>) {
  const mailboxId = (data.mailboxId ?? (data.payload as any)?.mailboxId) as string | undefined;
  if (!mailboxId) return { skipped: true };

  const mailbox = await prisma.coldMailbox.findUnique({ where: { id: mailboxId } });
  if (!mailbox || !mailbox.warmupEnabled || mailbox.warmupStatus !== 'warming' || mailbox.status !== 'active') {
    return { skipped: true, reason: 'mailbox not eligible for warmup' };
  }

  const persona = await prisma.persona.findFirst({ where: { mailboxId } });
  const warmupDay = persona?.warmupDay ?? 1;
  const dailyTarget = warmupDay <= 7 ? 5 : warmupDay <= 14 ? 10 : warmupDay <= 21 ? 20 : warmupDay <= 28 ? 35 : 50;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayLog = await prisma.warmupLog.findFirst({
    where: { mailboxId, date: { gte: today } },
  });
  const sentToday = todayLog?.emailsSent ?? 0;

  if (sentToday >= dailyTarget) {
    if (persona && persona.warmupDay < 35) {
      const nextDay = persona.warmupDay + 1;
      const nextLimit = nextDay <= 7 ? 5 : nextDay <= 14 ? 10 : nextDay <= 21 ? 20 : nextDay <= 28 ? 35 : 50;
      await prisma.persona.update({
        where: { id: persona.id },
        data: {
          warmupDay: nextDay,
          dailySendLimit: nextLimit,
          warmupStatus: nextDay >= 35 ? 'ready' : 'warming',
        },
      });
      if (nextDay >= 35) {
        await prisma.coldMailbox.update({ where: { id: mailboxId }, data: { warmupStatus: 'ready', dailySendLimit: 50 } });
      }
    }
    return { processed: true, action: 'daily_target_met', sentToday };
  }

  const warmupSubjects = ['Quick update', 'Following up', 'Checking in', 'Just a note', 'Brief hello', 'A thought', 'Quick question', 'Touching base'];
  const warmupBodies = [
    'Just wanted to check in and see how things are going. Let me know if you need anything.',
    'Hope your week is going well. Looking forward to connecting soon.',
    'Wanted to drop a quick note. Let me know if there is anything I can help with.',
    'Just a brief hello to stay in touch. Hope all is well on your end.',
  ];

  try {
    await sendViaSendGrid({
      tenantId: mailbox.tenantId ?? '',
      campaignId: `warmup-${mailboxId}`,
      recipientId: mailboxId,
      to: mailbox.email,
      fromEmail: mailbox.email,
      fromName: mailbox.fromName ?? mailbox.email,
      subject: warmupSubjects[Math.floor(Math.random() * warmupSubjects.length)],
      html: `<p>${warmupBodies[Math.floor(Math.random() * warmupBodies.length)]}</p>`,
    });

    if (todayLog) {
      await prisma.warmupLog.update({ where: { id: todayLog.id }, data: { emailsSent: { increment: 1 } } });
    } else {
      await prisma.warmupLog.create({
        data: { personaId: persona?.id ?? mailboxId, mailboxId, date: today, emailsSent: 1, emailsReceived: 0, repliesReceived: 0, spamCount: 0, bounceCount: 0 },
      });
    }

    await prisma.coldMailbox.update({ where: { id: mailboxId }, data: { sentToday: { increment: 1 }, totalSent: { increment: 1 } } });
  } catch (error) {
    await prisma.providerLog.create({
      data: {
        tenantId: mailbox.tenantId ?? '',
        provider: 'sendgrid',
        operation: 'warmup_email',
        status: 'failed',
        request: { mailboxId, email: mailbox.email },
        error: error instanceof Error ? error.message : String(error),
      },
    }).catch(() => undefined);
  }

  const delayMs = (1800 + Math.random() * 1800) * 1000;
  const queue = new (await import('bullmq')).Queue('mailbox-warmup', { connection: connection as never });
  await queue.add('warmup', { mailboxId, tenantId: mailbox.tenantId }, { delay: delayMs });
  await queue.close();

  return { processed: true, sent: sentToday + 1, target: dailyTarget };
}

const handlers: Record<string, (data: Record<string, unknown>) => Promise<Record<string, unknown>>> = {
  'email-campaigns': processEmailCampaign,
  'cold-email-sequences': processColdSequenceTick,
  'mailbox-warmup': processMailboxWarmup,
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
