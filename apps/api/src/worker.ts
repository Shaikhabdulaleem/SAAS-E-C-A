import 'reflect-metadata';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { CampaignStatus, DnsRecordStatus, EmailEventType, JobStatus, PrismaClient } from '@prisma/client';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Resolver } from 'dns/promises';
import { contentQaWarnings, renderEmailWithTracking, resolveSelectedVariant, resolveVariantById, getVariantIds, htmlToPlainText } from './email/email-rendering';
import { sendViaSendGrid } from './providers/services/email-delivery.util';

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
  if (campaign.status === CampaignStatus.paused) return { skipped: true, reason: 'campaign paused' };

  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: { status: CampaignStatus.sending, lastError: null },
  });

  const senderDomain = campaign.fromEmail?.split('@')[1]?.toLowerCase();
  const domainRecord = senderDomain
    ? await prisma.sendingDomain.findFirst({ where: { tenantId: campaign.tenantId, domain: senderDomain } })
    : null;
  const domainCap = domainRecord?.currentDailyCap ?? 5000;
  const domainRemaining = Math.max(domainCap - (domainRecord?.sentToday ?? 0), 0);
  const effectiveLimit = Math.min(campaign.dailySendLimit ?? 5000, domainRemaining);

  if (effectiveLimit <= 0) {
    const continuationAt = new Date(Date.now() + 86400000);
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        sendContinuationAt: continuationAt,
        lastError: `Domain daily cap reached (${domainCap}/day). Sending will resume tomorrow.`,
      },
    });
    console.warn(`[WARMUP] Domain ${senderDomain} daily cap reached (${domainCap}). Re-enqueueing campaign ${campaignId} for tomorrow.`);
    const queue = new (await import('bullmq')).Queue('email-campaigns', { connection: connection as never });
    await queue.add('email.campaign.resume', { campaignId }, { delay: Math.max(0, continuationAt.getTime() - Date.now()) });
    await queue.close();
    return { processed: true, sent: 0, reason: 'domain daily cap reached, re-enqueued for tomorrow' };
  }

  const recipients = await prisma.campaignRecipient.findMany({
    where: { campaignId, status: 'queued', sentAt: null, providerRequestId: null },
    take: Math.max(effectiveLimit, 1),
  });
  let sent = 0;
  let failed = 0;
  const variantIds = getVariantIds(campaign);
  const isAbTest = campaign.abTestEnabled && variantIds.length >= 2;

  for (let ri = 0; ri < recipients.length; ri++) {
    const recipient = recipients[ri];
    const assignedVariantId = isAbTest ? variantIds[ri % variantIds.length] : undefined;
    const selected = assignedVariantId ? resolveVariantById(campaign, assignedVariantId) : resolveSelectedVariant(campaign);
    const latest = await prisma.emailCampaign.findUnique({ where: { id: campaignId }, select: { status: true } });
    if (latest?.status === CampaignStatus.cancelled) break;
    if (failed >= 10 && failed / Math.max(sent + failed, 1) >= 0.25) {
      await prisma.emailCampaign.update({
        where: { id: campaignId },
        data: { status: CampaignStatus.partial_failed, completedAt: new Date(), lastError: 'Campaign paused because provider failures exceeded 25%' },
      });
      break;
    }
    try {
      const claimed = await prisma.campaignRecipient.updateMany({
        where: { id: recipient.id, status: 'queued', sentAt: null, providerRequestId: null },
        data: { attempts: { increment: 1 }, ...(assignedVariantId ? { variantId: assignedVariantId } : {}) },
      });
      if (claimed.count === 0) continue;

      const mergeBody = (selected.body ?? '')
        .replace(/\{\{firstName\}\}/g, recipient.firstName ?? '')
        .replace(/\{\{first_name\}\}/g, recipient.firstName ?? '')
        .replace(/\{\{lastName\}\}/g, recipient.lastName ?? '')
        .replace(/\{\{last_name\}\}/g, recipient.lastName ?? '')
        .replace(/\{\{email\}\}/g, recipient.email)
        .replace(/\{\{companyName\}\}/g, campaign.fromName ?? '')
        .replace(/\{\{company\}\}/g, campaign.fromName ?? '');
      const mergeSubject = (selected.subject ?? '')
        .replace(/\{\{firstName\}\}/g, recipient.firstName ?? '')
        .replace(/\{\{first_name\}\}/g, recipient.firstName ?? '')
        .replace(/\{\{lastName\}\}/g, recipient.lastName ?? '')
        .replace(/\{\{last_name\}\}/g, recipient.lastName ?? '')
        .replace(/\{\{email\}\}/g, recipient.email)
        .replace(/\{\{companyName\}\}/g, campaign.fromName ?? '')
        .replace(/\{\{company\}\}/g, campaign.fromName ?? '');

      const rendered = await renderEmailWithTracking({
        store: prisma,
        body: mergeBody,
        tenantId: campaign.tenantId,
        campaignId: campaign.id,
        recipientId: recipient.id,
        email: recipient.email,
        trackOpens: campaign.trackOpens,
        trackClicks: campaign.trackClicks,
        companyAddress: campaign.companyAddress,
        subject: mergeSubject,
      });
      const html = rendered?.html ?? mergeBody;
      const unsubscribeUrl = rendered?.unsubscribeUrl;
      const plainText = campaign.bodyPlainText
        || htmlToPlainText(mergeBody) + (campaign.companyAddress ? `\n\n${campaign.companyAddress}` : '') + (unsubscribeUrl ? `\n\nUnsubscribe: ${unsubscribeUrl}` : '');

      let result: { provider: string; requestId?: string };
      let lastSendError: unknown;
      for (let retry = 0; retry < 3; retry++) {
        try {
          result = await sendViaSendGrid({
            tenantId: campaign.tenantId,
            campaignId: campaign.id,
            recipientId: recipient.id,
            to: recipient.email,
            fromEmail: campaign.fromEmail,
            fromName: campaign.fromName,
            subject: mergeSubject,
            html,
            text: plainText,
            replyTo: campaign.replyToEmail,
            unsubscribeUrl,
            ipPool: campaign.ipPool ?? undefined,
          }, prisma);
          lastSendError = null;
          break;
        } catch (err) {
          lastSendError = err;
          const msg = err instanceof Error ? err.message : String(err);
          const isTransient = /429|5\d{2}|ETIMEDOUT|ECONNRESET|socket hang up/i.test(msg);
          if (!isTransient || retry === 2) break;
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retry)));
        }
      }
      if (lastSendError) throw lastSendError;

      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: 'sent', sentAt: new Date(), providerRequestId: result!.requestId, lastError: null },
      });
      await prisma.emailEvent.create({
        data: {
          campaignId: campaign.id,
          recipientId: recipient.id,
          type: EmailEventType.delivered,
          providerId: result!.requestId,
          eventKey: result!.requestId ? `sendgrid:${result!.requestId}` : `local:${recipient.id}:delivered`,
        },
      }).catch(() => undefined);
      if (domainRecord) {
        await prisma.sendingDomain.update({ where: { id: domainRecord.id }, data: { sentToday: { increment: 1 } } }).catch(() => undefined);
      }
      if (recipient.contactId) {
        await prisma.contact.update({ where: { id: recipient.contactId }, data: { lastEmailSentAt: new Date(), emailSendCount: { increment: 1 } } }).catch(() => undefined);
      }
      sent++;
    } catch (error) {
      failed++;
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: recipient.attempts + 1 >= 3 ? 'failed' : 'queued',
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
      sendContinuationAt: remaining > 0 ? new Date(Date.now() + 86400000) : null,
      lastError: remaining > 0
        ? `Sent ${sent} today (domain cap: ${domainCap}/day). ${remaining} recipients will be sent tomorrow.`
        : permanentFailures > 0 ? `${permanentFailures} recipients failed` : null,
    },
  });

  if (remaining > 0 && nextStatus === CampaignStatus.sending) {
    console.log(`[WARMUP] Campaign ${campaignId}: sent ${sent}, ${remaining} remaining — re-enqueued for tomorrow`);
    const queue = new (await import('bullmq')).Queue('email-campaigns', { connection: connection as never });
    await queue.add('email.campaign.resume', { campaignId }, { delay: 86400000 });
    await queue.close();
  }

  return { processed: true, sent, failed, remaining };
}

async function reenqueueColdCampaign(campaignId: string, delayMs = 30 * 60 * 1000) {
  const queue = new (await import('bullmq')).Queue('cold-email-sequences', { connection: connection as never });
  await queue.add('tick', { campaignId }, { delay: delayMs, jobId: `cold:${campaignId}:${Math.floor((Date.now() + delayMs) / 60000)}` });
  await queue.close();
}

function zonedSendTime(timeZone = process.env.OUTREACH_SEND_TIMEZONE ?? 'UTC') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(value('weekday'));
  return { current: Number(`${value('hour')}${value('minute')}`), weekday: weekday < 0 ? new Date().getUTCDay() : weekday };
}

async function processColdSequenceTick(data: Record<string, unknown>) {
  const campaignId = (data.campaignId ?? (data.payload as any)?.campaignId) as string | undefined;
  if (!campaignId) return { skipped: true };
  const campaign = await prisma.coldCampaign.findUnique({
    where: { id: campaignId },
    include: {
      steps: { orderBy: { stepOrder: 'asc' } },
      mailboxes: { include: { mailbox: { include: { domain: true } } } },
    },
  });
  if (!campaign || campaign.status !== 'active') return { skipped: true, reason: 'campaign not active' };
  if (campaign.steps.length === 0) return { skipped: true, reason: 'no steps' };

  await prisma.coldSequenceState.updateMany({
    where: {
      campaignId,
      status: 'processing',
      processingStartedAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
    },
    data: { status: 'active', processingStartedAt: null, nextSendAfter: new Date() },
  });

  const BATCH_SIZE = 10;
  const pendingStates = await prisma.coldSequenceState.findMany({
    where: {
      campaignId,
      status: { in: ['queued', 'active'] },
      nextSendAfter: { lte: new Date() },
    },
    include: { prospect: true },
    take: BATCH_SIZE,
  });
  if (pendingStates.length === 0) return { processed: true, sent: 0 };

  // Paginated suppression check instead of loading entire set into memory
  const prospectEmails = pendingStates
    .filter((s) => s.prospect)
    .map((s) => s.prospect!.email.toLowerCase());
  const suppressedEntries = await prisma.suppressionEntry.findMany({
    where: { tenantId: campaign.tenantId ?? undefined, email: { in: prospectEmails } },
    select: { email: true },
  });
  const suppressedEmails = new Set(suppressedEntries.map((s) => s.email.toLowerCase()));

  const activeMailboxes = campaign.mailboxes
    .map((m) => m.mailbox)
    .filter((mb) => mb.status === 'active');

  if (activeMailboxes.length === 0) {
    await reenqueueColdCampaign(campaignId);
    return { processed: true, sent: 0, reason: 'no available mailboxes' };
  }

  const now = new Date();
  const sendTime = zonedSendTime();
  const sendableMailboxes = activeMailboxes.filter((mb) => {
    const start = parseInt(mb.sendWindowStart?.replace(':', '') ?? '0800', 10);
    const end = parseInt(mb.sendWindowEnd?.replace(':', '') ?? '1700', 10);
    if (mb.sendWeekdaysOnly && (sendTime.weekday === 0 || sendTime.weekday === 6)) return false;
    return sendTime.current >= start && sendTime.current <= end;
  });
  if (sendableMailboxes.length === 0) {
    await reenqueueColdCampaign(campaignId, 60 * 60 * 1000);
    return { processed: true, sent: 0, reason: 'outside send window' };
  }

  let mailboxIndex = 0;
  let sent = 0;
  let failed = 0;

  // Smart throttle: check campaign bounce rate, auto-pause if too high
  if (campaign.sentCount > 20) {
    const bounceRate = (campaign.bounceCount / campaign.sentCount) * 100;
    if (bounceRate > 5) {
      await prisma.coldCampaign.update({ where: { id: campaignId }, data: { status: 'paused' } });
      if (campaign.tenantId) {
        await prisma.notification.create({
          data: { tenantId: campaign.tenantId, type: 'system', title: 'Campaign Auto-Paused',
            body: `"${campaign.name}" paused — bounce rate ${bounceRate.toFixed(1)}% exceeds 5% threshold. Review your prospect list quality.`,
            metadata: { campaignId, bounceRate } },
        }).catch(() => undefined);
      }
      return { processed: true, sent: 0, reason: 'auto-paused due to high bounce rate' };
    }
  }

  // Track domain daily caps in memory for this batch
  const domainSentMap = new Map<string, number>();

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

    const claimed = await prisma.coldSequenceState.updateMany({
      where: { id: state.id, status: { in: ['queued', 'active'] }, currentStepId: state.currentStepId },
      data: { status: 'processing', processingStartedAt: now },
    });
    if (claimed.count === 0) continue;

    const mailbox = sendableMailboxes[mailboxIndex % sendableMailboxes.length];

    // Check mailbox daily limit from DB (not stale in-memory value)
    const freshMailbox = await prisma.coldMailbox.findUnique({ where: { id: mailbox.id }, select: { sentToday: true, dailySendLimit: true } });
    if (!freshMailbox || freshMailbox.sentToday >= freshMailbox.dailySendLimit) {
      await prisma.coldSequenceState.update({ where: { id: state.id }, data: { status: 'active', processingStartedAt: null, nextSendAfter: new Date(Date.now() + 30 * 60 * 1000) } });
      await reenqueueColdCampaign(campaignId);
      continue;
    }

    // Use the domain from the original campaign query (includes domain: true), not the re-fetched mailbox
    const domain = (mailbox as any).domain as { id: string; currentDailyCap: number | null } | null;
    if (domain) {
      if (!domainSentMap.has(domain.id)) {
        const freshDomain = await prisma.sendingDomain.findUnique({ where: { id: domain.id }, select: { sentToday: true, currentDailyCap: true } });
        domainSentMap.set(domain.id, freshDomain?.sentToday ?? 0);
      }
      const domainSent = domainSentMap.get(domain.id)!;
      const domainCap = domain.currentDailyCap ?? 50;
      if (domainSent >= domainCap) {
        await prisma.coldSequenceState.update({ where: { id: state.id }, data: { status: 'active', processingStartedAt: null, nextSendAfter: new Date(Date.now() + 60 * 60 * 1000) } });
        continue;
      }
    }

    mailboxIndex++;

    const senderName = mailbox.fromName ?? mailbox.email.split('@')[0];
    const senderFirstName = senderName.split(' ')[0] ?? senderName;
    const senderLastName = senderName.split(' ').slice(1).join(' ') ?? '';

    // Build unsubscribe URL
    const unsubscribeUrl = `${process.env.APP_URL ?? 'https://app.example.com'}/unsubscribe?cid=${campaignId}&pid=${state.prospectId}`;

    const renderTemplate = (text: string) =>
      text
        .replace(/\{\{firstName\}\}/g, prospect.firstName ?? '')
        .replace(/\{\{first_name\}\}/g, prospect.firstName ?? '')
        .replace(/\{\{lastName\}\}/g, prospect.lastName ?? '')
        .replace(/\{\{last_name\}\}/g, prospect.lastName ?? '')
        .replace(/\{\{company\}\}/g, prospect.companyName ?? '')
        .replace(/\{\{companyName\}\}/g, prospect.companyName ?? '')
        .replace(/\{\{jobTitle\}\}/g, prospect.jobTitle ?? '')
        .replace(/\{\{job_title\}\}/g, prospect.jobTitle ?? '')
        .replace(/\{\{email\}\}/g, prospect.email)
        .replace(/\{\{senderFirstName\}\}/g, senderFirstName)
        .replace(/\{\{senderLastName\}\}/g, senderLastName)
        .replace(/\{\{senderName\}\}/g, senderName)
        .replace(/\{\{senderEmail\}\}/g, mailbox.email)
        .replace(/\{\{unsubscribeUrl\}\}/g, unsubscribeUrl)
        .replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl);

    const subject = renderTemplate(currentStep.subject ?? '');
    const rawBody = renderTemplate(currentStep.body);

    // Auto-append unsubscribe footer if not already present
    const hasUnsubLink = rawBody.includes(unsubscribeUrl) || /\{\{unsubscribe/i.test(currentStep.body);
    const bodyWithUnsub = hasUnsubLink ? rawBody : `${rawBody}<p style="font-size:11px;color:#999;margin-top:24px;">If you no longer wish to receive these emails, <a href="${unsubscribeUrl}" style="color:#999;">unsubscribe here</a>.</p>`;

    const coldRendered = await renderEmailWithTracking({ store: prisma, body: bodyWithUnsub, tenantId: campaign.tenantId ?? '', campaignId, recipientId: state.prospectId, email: prospect.email, trackOpens: campaign.trackOpens, trackClicks: campaign.trackClicks });
    const body = coldRendered?.html ?? bodyWithUnsub;

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
      }, prisma);

      // Atomic post-send updates: event + state + counters
      await prisma.$transaction(async (tx) => {
        await tx.coldEmailEvent.create({
          data: { campaignId, prospectId: state.prospectId, type: 'sent', stepOrder: currentStep.stepOrder, metadata: {} },
        });

        const nextStep = campaign.steps.find((s) => s.stepOrder > currentStep.stepOrder);
        if (nextStep) {
          await tx.coldSequenceState.update({
            where: { id: state.id },
            data: {
              currentStepId: nextStep.id,
              status: 'active',
              processingStartedAt: null,
              lastSentAt: now,
              nextSendAfter: new Date(now.getTime() + (nextStep.delayDays ?? 2) * 86400000),
            },
          });
        } else {
          await tx.coldSequenceState.update({
            where: { id: state.id },
            data: { status: 'completed', processingStartedAt: null, lastSentAt: now, completedAt: now },
          });
        }

        await tx.coldMailbox.update({ where: { id: mailbox.id }, data: { sentToday: { increment: 1 }, totalSent: { increment: 1 } } });
        await tx.coldCampaign.update({ where: { id: campaignId }, data: { sentCount: { increment: 1 } } });

        if (domain) {
          await tx.sendingDomain.update({ where: { id: domain.id }, data: { sentToday: { increment: 1 } } });
        }
      });

      // Update in-memory domain tracking
      if (domain) {
        domainSentMap.set(domain.id, (domainSentMap.get(domain.id) ?? 0) + 1);
      }

      const persona = await prisma.persona.findFirst({ where: { mailboxId: mailbox.id } });
      if (persona) {
        try {
          await prisma.sendingLog.create({
            data: { personaId: persona.id, mailboxId: mailbox.id, campaignId, prospectId: state.prospectId, sentAt: now, status: 'sent' },
          });
        } catch (logErr) {
          console.error(`[COLD_SEND] Failed to create sending log for prospect ${state.prospectId}:`, logErr instanceof Error ? logErr.message : logErr);
        }
      }

      sent++;
    } catch (error) {
      failed++;
      try {
        await prisma.coldSequenceState.update({
          where: { id: state.id },
          data: {
            status: 'active',
            processingStartedAt: null,
            nextSendAfter: new Date(Date.now() + 30 * 60 * 1000),
          },
        });
      } catch (stateErr) {
        console.error(`[COLD_SEND] Failed to revert state for ${state.id}:`, stateErr instanceof Error ? stateErr.message : stateErr);
      }
      try {
        await prisma.providerLog.create({
          data: {
            tenantId: campaign.tenantId ?? '',
            provider: 'sendgrid',
            operation: 'cold_email_send',
            status: 'failed',
            request: { to: prospect.email, campaignId },
            error: error instanceof Error ? error.message : String(error),
          },
        });
      } catch (logErr) {
        console.error(`[COLD_SEND] Failed to log send failure:`, logErr instanceof Error ? logErr.message : logErr);
      }
    }
  }

  // Re-enqueue with BullMQ delay instead of blocking with setTimeout
  const remaining = await prisma.coldSequenceState.count({
    where: { campaignId, status: { in: ['queued', 'active'] } },
  });
  if (remaining > 0) {
    let delayMs: number;
    if (sent === 0) {
      // No sends happened this tick — all mailboxes likely at capacity or outside window
      // Back off to 30 minutes instead of spinning every 60 seconds
      delayMs = 30 * 60 * 1000;
    } else {
      const minDelay = sendableMailboxes[0]?.minDelaySeconds ?? 60;
      const maxDelay = sendableMailboxes[0]?.maxDelaySeconds ?? 180;
      delayMs = Math.max((minDelay + Math.random() * (maxDelay - minDelay)) * 1000, 60000);
    }
    const queue = new (await import('bullmq')).Queue('cold-email-sequences', { connection: connection as never });
    await queue.add('tick', { campaignId }, { delay: delayMs });
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
    }, prisma);

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

// ── Encryption helpers (same as EncryptionService but standalone for worker) ──

function workerDecrypt(ciphertext: string): string {
  const key = createHash('sha256').update(process.env.ENCRYPTION_KEY ?? '').digest();
  const parts = ciphertext.split('.');
  if (parts.length !== 3) throw new Error('Invalid ciphertext format');
  const iv = Buffer.from(parts[0], 'base64url');
  const tag = Buffer.from(parts[1], 'base64url');
  const encrypted = Buffer.from(parts[2], 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

// ── Domain Purchase Pipeline ─────────────────────────────────────────────

async function processDomainPurchasePipeline(data: Record<string, unknown>) {
  const payload = (data.payload ?? data) as Record<string, unknown>;
  const orderId = payload.orderId as string;
  const phase = payload.phase as string;
  if (!orderId || !phase) return { skipped: true, reason: 'missing orderId or phase' };

  const order = await prisma.domainPurchaseOrder.findUnique({ where: { id: orderId } });
  if (!order) return { skipped: true, reason: 'order not found' };

  try {
    switch (phase) {
      case 'check_availability': return await pipelineCheckAvailability(order);
      case 'purchase_domains': return await pipelinePurchaseDomains(order);
      case 'configure_dns': return await pipelineConfigureDns(order);
      case 'create_mailboxes': return await pipelineCreateMailboxes(order);
      case 'enroll_warmup': return await pipelineEnrollWarmup(order);
      default: return { skipped: true, reason: `unknown phase: ${phase}` };
    }
  } catch (error) {
    await prisma.domainPurchaseOrder.update({
      where: { id: orderId },
      data: { status: 'failed', lastError: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
}

async function pipelineCheckAvailability(order: any) {
  const integration = await prisma.tenantIntegration.findFirst({
    where: { tenantId: order.tenantId, platformKey: order.registrarProvider, isActive: true },
  });
  if (!integration) throw new Error(`${order.registrarProvider} not connected`);
  const creds = JSON.parse(workerDecrypt(integration.apiKeyCipher));

  const domains = order.domains as any[];
  const domainNames = domains.map((d: any) => d.domain);

  const results = await workerCheckDomains(order.registrarProvider, creds, domainNames, order.tenantId);

  const updated = domains.map((d: any) => {
    const result = results.find((r) => r.domain === d.domain);
    return { ...d, available: result?.available ?? false, price: result?.price ?? null };
  });

  await prisma.domainPurchaseOrder.update({
    where: { id: order.id },
    data: { domains: updated, status: 'awaiting_confirmation' },
  });

  return { processed: true, available: updated.filter((d: any) => d.available).length, total: updated.length };
}

async function workerCheckDomains(provider: string, creds: any, domains: string[], tenantId: string) {
  const results: Array<{ domain: string; available: boolean; price: number | null }> = [];

  if (provider === 'namecheap') {
    for (let i = 0; i < domains.length; i += 50) {
      const batch = domains.slice(i, i + 50);
      const qs = new URLSearchParams({
        ApiUser: creds.apiUser ?? '', ApiKey: creds.apiKey ?? '', UserName: creds.userName ?? creds.apiUser ?? '',
        ClientIp: creds.clientIp ?? '0.0.0.0', Command: 'namecheap.domains.check', DomainList: batch.join(','),
      });
      const response = await fetch(`https://api.namecheap.com/xml.response?${qs}`);
      const xml = await response.text();
      const regex = /Domain="([^"]+)"\s+Available="([^"]+)"/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(xml)) !== null) {
        const tld = match[1].split('.').slice(1).join('.');
        const prices: Record<string, number> = { com: 10.98, io: 32.98, co: 11.98, net: 12.98, org: 9.98 };
        results.push({ domain: match[1], available: match[2] === 'true', price: prices[tld] ?? 12.98 });
      }
    }
  } else if (provider === 'porkbun') {
    for (const domain of domains) {
      try {
        const r = await fetch('https://api.porkbun.com/api/json/v3/domain/check', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apikey: creds.apikey, secretapikey: creds.secretapikey, domain }),
        });
        const d = await r.json();
        results.push({ domain, available: d.status === 'SUCCESS' && d.available === true, price: d.pricing?.registration ? parseFloat(d.pricing.registration) : null });
      } catch { results.push({ domain, available: false, price: null }); }
    }
  } else if (provider === 'dynadot') {
    for (const domain of domains) {
      try {
        const r = await fetch(`https://api.dynadot.com/api3.json?key=${encodeURIComponent(creds.apiKey)}&command=search&domain0=${encodeURIComponent(domain)}`);
        const d = await r.json();
        const sr = d?.SearchResponse?.SearchResults?.[0] ?? {};
        results.push({ domain, available: sr.Available === 'yes', price: sr.Price ? parseFloat(sr.Price) : null });
      } catch { results.push({ domain, available: false, price: null }); }
    }
  } else if (provider === 'godaddy') {
    for (const domain of domains) {
      try {
        const r = await fetch(`https://api.godaddy.com/v1/domains/available?domain=${encodeURIComponent(domain)}`, {
          headers: { Authorization: `sso-key ${creds.key}:${creds.secret}` },
        });
        const d = await r.json();
        results.push({ domain, available: d.available === true, price: d.price ? d.price / 1000000 : null });
      } catch { results.push({ domain, available: false, price: null }); }
    }
  }
  return results;
}

async function pipelinePurchaseDomains(order: any) {
  const integration = await prisma.tenantIntegration.findFirst({
    where: { tenantId: order.tenantId, platformKey: order.registrarProvider, isActive: true },
  });
  if (!integration) throw new Error(`${order.registrarProvider} not connected`);
  const creds = JSON.parse(workerDecrypt(integration.apiKeyCipher));

  const domains = order.domains as any[];
  let purchased = 0;

  for (const d of domains) {
    if (!d.selected || !d.available || d.purchaseStatus !== 'pending') continue;
    try {
      const success = await workerPurchaseDomain(order.registrarProvider, creds, d.domain, order.tenantId);
      d.purchaseStatus = success ? 'purchased' : 'failed';
      d.purchaseError = success ? undefined : 'Purchase failed';
      if (success) purchased++;
    } catch (err) {
      d.purchaseStatus = 'failed';
      d.purchaseError = err instanceof Error ? err.message : 'Purchase failed';
    }
    await prisma.domainPurchaseOrder.update({ where: { id: order.id }, data: { domains: domains } });
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (purchased > 0) {
    await prisma.domainPurchaseOrder.update({ where: { id: order.id }, data: { status: 'setting_nameservers' } });
    const queue = new (await import('bullmq')).Queue('domain-purchase-pipeline', { connection: connection as never });
    await queue.add('configure_dns', { orderId: order.id, phase: 'configure_dns' }, { delay: 5000 });
    await queue.close();
  } else {
    await prisma.domainPurchaseOrder.update({ where: { id: order.id }, data: { status: 'failed', lastError: 'No domains purchased successfully' } });
  }

  return { processed: true, purchased };
}

async function workerPurchaseDomain(provider: string, creds: any, domain: string, tenantId: string): Promise<boolean> {
  if (provider === 'namecheap') {
    const qs = new URLSearchParams({
      ApiUser: creds.apiUser ?? '', ApiKey: creds.apiKey ?? '', UserName: creds.userName ?? creds.apiUser ?? '',
      ClientIp: creds.clientIp ?? '0.0.0.0', Command: 'namecheap.domains.create', DomainName: domain, Years: '1',
      RegistrantFirstName: 'Domain', RegistrantLastName: 'Admin', RegistrantAddress1: '123 Main St',
      RegistrantCity: 'New York', RegistrantStateProvince: 'NY', RegistrantPostalCode: '10001', RegistrantCountry: 'US',
      RegistrantPhone: '+1.5555555555', RegistrantEmailAddress: 'admin@domain.com',
      TechFirstName: 'Domain', TechLastName: 'Admin', TechAddress1: '123 Main St', TechCity: 'New York',
      TechStateProvince: 'NY', TechPostalCode: '10001', TechCountry: 'US', TechPhone: '+1.5555555555', TechEmailAddress: 'admin@domain.com',
      AdminFirstName: 'Domain', AdminLastName: 'Admin', AdminAddress1: '123 Main St', AdminCity: 'New York',
      AdminStateProvince: 'NY', AdminPostalCode: '10001', AdminCountry: 'US', AdminPhone: '+1.5555555555', AdminEmailAddress: 'admin@domain.com',
      AuxBillingFirstName: 'Domain', AuxBillingLastName: 'Admin', AuxBillingAddress1: '123 Main St', AuxBillingCity: 'New York',
      AuxBillingStateProvince: 'NY', AuxBillingPostalCode: '10001', AuxBillingCountry: 'US', AuxBillingPhone: '+1.5555555555', AuxBillingEmailAddress: 'admin@domain.com',
      AddFreeWhoisguard: 'yes', WGEnabled: 'yes',
    });
    const r = await fetch(`https://api.namecheap.com/xml.response?${qs}`);
    const xml = await r.text();
    return xml.includes('Registered="true"') || xml.includes('Status="OK"');
  }
  if (provider === 'porkbun') {
    const r = await fetch('https://api.porkbun.com/api/json/v3/domain/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apikey: creds.apikey, secretapikey: creds.secretapikey, domain, years: '1' }),
    });
    const d = await r.json();
    return d.status === 'SUCCESS';
  }
  if (provider === 'dynadot') {
    const r = await fetch(`https://api.dynadot.com/api3.json?key=${encodeURIComponent(creds.apiKey)}&command=register&domain=${encodeURIComponent(domain)}&duration=1`);
    const d = await r.json();
    return d?.RegisterResponse?.Status === 'success';
  }
  if (provider === 'godaddy') {
    const r = await fetch('https://api.godaddy.com/v1/domains/purchase', {
      method: 'POST', headers: { Authorization: `sso-key ${creds.key}:${creds.secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, consent: { agreedAt: new Date().toISOString(), agreedBy: '0.0.0.0', agreementKeys: ['DNRA'] }, period: 1, privacy: true, renewAuto: false,
        contactAdmin: { firstName: 'Domain', lastName: 'Admin', email: 'admin@domain.com', phone: '+1.5555555555', addressMailing: { address1: '123 Main St', city: 'New York', state: 'NY', postalCode: '10001', country: 'US' } },
        contactRegistrant: { firstName: 'Domain', lastName: 'Admin', email: 'admin@domain.com', phone: '+1.5555555555', addressMailing: { address1: '123 Main St', city: 'New York', state: 'NY', postalCode: '10001', country: 'US' } },
        contactTech: { firstName: 'Domain', lastName: 'Admin', email: 'admin@domain.com', phone: '+1.5555555555', addressMailing: { address1: '123 Main St', city: 'New York', state: 'NY', postalCode: '10001', country: 'US' } },
      }),
    });
    return r.ok;
  }
  return false;
}

async function pipelineConfigureDns(order: any) {
  const cfIntegration = await prisma.tenantIntegration.findFirst({
    where: { tenantId: order.tenantId, platformKey: 'cloudflare', isActive: true },
  });
  if (!cfIntegration) throw new Error('Cloudflare not connected');
  const cfApiKey = workerDecrypt(cfIntegration.apiKeyCipher);

  const regIntegration = await prisma.tenantIntegration.findFirst({
    where: { tenantId: order.tenantId, platformKey: order.registrarProvider, isActive: true },
  });
  const regCreds = regIntegration ? JSON.parse(workerDecrypt(regIntegration.apiKeyCipher)) : null;

  const domains = order.domains as any[];
  await prisma.domainPurchaseOrder.update({ where: { id: order.id }, data: { status: 'configuring_dns' } });

  for (const d of domains) {
    if (d.purchaseStatus !== 'purchased' || d.dnsStatus !== 'pending') continue;
    try {
      const zoneResponse = await fetch('https://api.cloudflare.com/client/v4/zones', {
        method: 'POST', headers: { Authorization: `Bearer ${cfApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: d.domain, jump_start: true }),
      });
      const zoneData = await zoneResponse.json() as any;
      if (!zoneResponse.ok) { d.dnsStatus = 'failed'; d.dnsError = zoneData?.errors?.[0]?.message ?? 'Zone creation failed'; continue; }

      d.cloudflareZoneId = zoneData.result.id;
      d.cloudflareNameservers = zoneData.result.name_servers;
      d.dnsStatus = 'zone_created';

      if (regCreds) {
        await workerSetNameservers(order.registrarProvider, regCreds, d.domain, zoneData.result.name_servers);
        d.dnsStatus = 'nameservers_set';
      }

      const dnsRecords = [
        { type: 'TXT', name: d.domain, value: 'v=spf1 include:spf.protection.outlook.com include:sendgrid.net ~all', ttl: 1 },
        { type: 'TXT', name: `_dmarc.${d.domain}`, value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${d.domain}`, ttl: 1 },
        { type: 'MX', name: d.domain, value: `${d.domain.replace(/\./g, '-')}.mail.protection.outlook.com`, priority: 0, ttl: 1 },
      ];
      for (const record of dnsRecords) {
        await fetch(`https://api.cloudflare.com/client/v4/zones/${d.cloudflareZoneId}/dns_records`, {
          method: 'POST', headers: { Authorization: `Bearer ${cfApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: record.type, name: record.name, content: record.value, ttl: record.ttl, priority: record.priority }),
        });
      }
      d.dnsStatus = 'records_created';

      const sendingDomain = await prisma.sendingDomain.create({
        data: {
          tenantId: order.tenantId, domain: d.domain, dnsProvider: 'cloudflare',
          dnsApiKeyCipher: cfIntegration.apiKeyCipher, dnsZoneId: d.cloudflareZoneId,
          providerCredentialId: order.providerCredentialId,
          spfStatus: DnsRecordStatus.not_set, dkimStatus: DnsRecordStatus.not_set,
          dmarcStatus: DnsRecordStatus.not_set, mxStatus: DnsRecordStatus.not_set,
          targetDailyVolume: 50, requiredMailboxes: 1,
        },
      });
      d.sendingDomainId = sendingDomain.id;
    } catch (err) {
      d.dnsStatus = 'failed';
      d.dnsError = err instanceof Error ? err.message : 'DNS configuration failed';
    }
    await prisma.domainPurchaseOrder.update({ where: { id: order.id }, data: { domains: domains } });
  }

  const dnsConfigured = domains.filter((d: any) => d.sendingDomainId).length;
  if (dnsConfigured > 0) {
    await prisma.domainPurchaseOrder.update({ where: { id: order.id }, data: { status: 'creating_mailboxes' } });
    const queue = new (await import('bullmq')).Queue('domain-purchase-pipeline', { connection: connection as never });
    await queue.add('create_mailboxes', { orderId: order.id, phase: 'create_mailboxes' }, { delay: 5000 });
    await queue.close();
  } else {
    await prisma.domainPurchaseOrder.update({ where: { id: order.id }, data: { status: 'failed', lastError: 'No domains configured successfully' } });
  }
  return { processed: true, configured: dnsConfigured };
}

async function workerSetNameservers(provider: string, creds: any, domain: string, nameservers: string[]) {
  if (provider === 'namecheap') {
    const [sld, ...tldParts] = domain.split('.'); const tld = tldParts.join('.');
    const qs = new URLSearchParams({
      ApiUser: creds.apiUser ?? '', ApiKey: creds.apiKey ?? '', UserName: creds.userName ?? creds.apiUser ?? '',
      ClientIp: creds.clientIp ?? '0.0.0.0', Command: 'namecheap.domains.dns.setCustom', SLD: sld, TLD: tld, Nameservers: nameservers.join(','),
    });
    await fetch(`https://api.namecheap.com/xml.response?${qs}`);
  } else if (provider === 'porkbun') {
    await fetch(`https://api.porkbun.com/api/json/v3/domain/updateNs/${domain}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apikey: creds.apikey, secretapikey: creds.secretapikey, ns: nameservers }),
    });
  } else if (provider === 'dynadot') {
    const nsParams = nameservers.map((ns, i) => `ns${i}=${encodeURIComponent(ns)}`).join('&');
    await fetch(`https://api.dynadot.com/api3.json?key=${encodeURIComponent(creds.apiKey)}&command=set_ns&domain=${encodeURIComponent(domain)}&${nsParams}`);
  } else if (provider === 'godaddy') {
    await fetch(`https://api.godaddy.com/v1/domains/${encodeURIComponent(domain)}`, {
      method: 'PATCH', headers: { Authorization: `sso-key ${creds.key}:${creds.secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nameServers: nameservers }),
    });
  }
}

async function pipelineCreateMailboxes(order: any) {
  const domains = order.domains as any[];
  const credential = order.providerCredentialId
    ? await prisma.emailProviderCredential.findUnique({ where: { id: order.providerCredentialId } })
    : null;

  if (!credential) {
    await prisma.domainPurchaseOrder.update({ where: { id: order.id }, data: { status: 'failed', lastError: 'No Microsoft 365 credential configured' } });
    return { processed: true, created: 0 };
  }

  const msTenantId = credential.msTenantIdCipher ? workerDecrypt(credential.msTenantIdCipher) : '';
  const clientId = credential.clientIdCipher ? workerDecrypt(credential.clientIdCipher) : '';
  const clientSecret = credential.clientSecretCipher ? workerDecrypt(credential.clientSecretCipher) : '';

  const firstNames = ['James', 'Sarah', 'Michael', 'Emily', 'David', 'Jessica', 'Robert', 'Ashley', 'John', 'Amanda',
    'William', 'Olivia', 'Benjamin', 'Sophia', 'Alexander', 'Isabella', 'Daniel', 'Mia', 'Matthew', 'Charlotte'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor',
    'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson'];
  let created = 0;
  const mbPerDomain = order.mailboxesPerDomain ?? 1;
  const usedEmails = new Set<string>();

  for (const d of domains) {
    if (!d.sendingDomainId || d.mailboxStatus !== 'pending') continue;
    let domainCreated = 0;
    try {
      const tokenRes = await fetch(`https://login.microsoftonline.com/${msTenantId}/oauth2/v2.0/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope: 'https://graph.microsoft.com/.default' }),
      });
      const tokenData = await tokenRes.json() as any;
      if (!tokenData.access_token) { d.mailboxStatus = 'failed'; d.mailboxError = 'Failed to get M365 token'; continue; }

      for (let mbIdx = 0; mbIdx < mbPerDomain; mbIdx++) {
        let firstName: string, lastName: string, localPart: string, email: string;
        let attempts = 0;
        do {
          const fi = Math.floor(Math.random() * firstNames.length);
          const li = Math.floor(Math.random() * lastNames.length);
          firstName = firstNames[fi]; lastName = lastNames[li];
          const format = order.emailFormat ?? 'firstname.lastname';
          localPart = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
          if (format === 'firstname') localPart = firstName.toLowerCase();
          else if (format === 'firstnamelastname') localPart = `${firstName.toLowerCase()}${lastName.toLowerCase()}`;
          else if (format === 'f.lastname') localPart = `${firstName[0].toLowerCase()}.${lastName.toLowerCase()}`;
          email = `${localPart}@${d.domain}`;
          attempts++;
        } while (usedEmails.has(email) && attempts < 50);
        usedEmails.add(email);

        const tempPassword = randomBytes(9).toString('base64url') + '!A1';
        const userRes = await fetch('https://graph.microsoft.com/v1.0/users', {
          method: 'POST', headers: { Authorization: `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountEnabled: true, displayName: `${firstName} ${lastName}`, mailNickname: localPart.replace(/\./g, ''),
            userPrincipalName: email, passwordProfile: { password: tempPassword, forceChangePasswordNextSignIn: true },
            usageLocation: 'US',
          }),
        });
        if (!userRes.ok) continue;

        const mailbox = await prisma.coldMailbox.create({
          data: {
            tenantId: order.tenantId, provider: 'outlook', email, fromName: `${firstName} ${lastName}`,
            dailySendLimit: 5, minDelaySeconds: 180, maxDelaySeconds: 480,
            warmupEnabled: true, warmupStatus: 'warming', domainId: d.sendingDomainId,
          },
        });
        await prisma.persona.create({
          data: {
            tenantId: order.tenantId, domainId: d.sendingDomainId, mailboxId: mailbox.id,
            firstName, lastName, email, jobTitle: order.jobTitle ?? 'Sales Development Rep',
            companyName: order.companyName ?? d.domain.split('.')[0],
            warmupStatus: 'warming', warmupDay: 1, healthScore: 10, dailySendLimit: 5,
          },
        });
        await prisma.linkedInSlot.create({
          data: { personaId: (await prisma.persona.findFirst({ where: { mailboxId: mailbox.id } }))!.id },
        }).catch(() => undefined);
        domainCreated++;
        created++;
        await new Promise((r) => setTimeout(r, 2000));
      }

      d.mailboxStatus = domainCreated > 0 ? 'created' : 'failed';
      d.mailboxError = domainCreated === 0 ? 'No mailboxes created' : undefined;
    } catch (err) {
      d.mailboxStatus = domainCreated > 0 ? 'created' : 'failed';
      d.mailboxError = err instanceof Error ? err.message : 'Mailbox creation failed';
    }
    await prisma.domainPurchaseOrder.update({ where: { id: order.id }, data: { domains: domains } });
  }

  if (created > 0) {
    await prisma.domainPurchaseOrder.update({ where: { id: order.id }, data: { status: 'warming_up' } });
    const queue = new (await import('bullmq')).Queue('domain-purchase-pipeline', { connection: connection as never });
    await queue.add('enroll_warmup', { orderId: order.id, phase: 'enroll_warmup' }, { delay: 3000 });
    await queue.close();
  } else {
    await prisma.domainPurchaseOrder.update({ where: { id: order.id }, data: { status: 'failed', lastError: 'No mailboxes created' } });
  }
  return { processed: true, created };
}

async function pipelineEnrollWarmup(order: any) {
  const domains = order.domains as any[];
  const warmupQueue = new (await import('bullmq')).Queue('mailbox-warmup', { connection: connection as never });
  let enrolled = 0;

  for (const d of domains) {
    if (d.mailboxStatus !== 'created' || d.warmupStatus !== 'pending') continue;
    const mailbox = d.sendingDomainId ? await prisma.coldMailbox.findFirst({ where: { domainId: d.sendingDomainId, tenantId: order.tenantId } }) : null;
    if (mailbox) {
      await warmupQueue.add('warmup', { mailboxId: mailbox.id, tenantId: order.tenantId }, { delay: 60000 });
      d.warmupStatus = 'enrolled';
      enrolled++;
    }
  }

  await warmupQueue.close();
  await prisma.domainPurchaseOrder.update({
    where: { id: order.id },
    data: { domains: domains, status: 'completed', completedAt: new Date() },
  });

  return { processed: true, enrolled };
}

// ── System Cron — Automation Heartbeat ───────────────────────────────────

async function processSystemCron(_data: Record<string, unknown>) {
  const now = new Date();
  const hour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay();
  const results: Record<string, unknown> = {};

  // 1. Reset sentToday at midnight UTC
  if (hour === 0) {
    const resetResult = await prisma.coldMailbox.updateMany({ where: { sentToday: { gt: 0 } }, data: { sentToday: 0 } });
    const domainReset = await prisma.sendingDomain.updateMany({ where: { sentToday: { gt: 0 } }, data: { sentToday: 0 } });
    results.sentTodayReset = resetResult.count;
    results.domainSentTodayReset = domainReset.count;
  }

  // 2. Auto-advance warmup for personas who met daily target
  const warmingPersonas = await prisma.persona.findMany({ where: { warmupStatus: 'warming' } });
  let warmupAdvanced = 0;
  for (const persona of warmingPersonas) {
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const todayLog = await prisma.warmupLog.findFirst({ where: { personaId: persona.id, date: { gte: today } } });
    const dailyTarget = persona.warmupDay <= 7 ? 5 : persona.warmupDay <= 14 ? 10 : persona.warmupDay <= 21 ? 20 : persona.warmupDay <= 28 ? 35 : 50;
    if (todayLog && todayLog.emailsSent >= dailyTarget && hour >= 22) {
      const nextDay = persona.warmupDay + 1;
      const nextLimit = nextDay <= 7 ? 5 : nextDay <= 14 ? 10 : nextDay <= 21 ? 20 : nextDay <= 28 ? 35 : 50;
      const isReady = nextDay >= 35;
      await prisma.persona.update({
        where: { id: persona.id },
        data: { warmupDay: nextDay, dailySendLimit: nextLimit, warmupStatus: isReady ? 'ready' : 'warming' },
      });
      if (persona.mailboxId) {
        await prisma.coldMailbox.update({ where: { id: persona.mailboxId }, data: { warmupStatus: isReady ? 'ready' : 'warming', dailySendLimit: nextLimit } });
      }
      if (isReady && persona.tenantId) {
        await prisma.notification.create({
          data: { tenantId: persona.tenantId, type: 'system', title: 'Mailbox Warmup Complete', body: `${persona.email} is warmed up and ready for campaigns!`, metadata: { personaId: persona.id, email: persona.email } },
        }).catch(() => undefined);
      }
      warmupAdvanced++;
    }
  }
  results.warmupAdvanced = warmupAdvanced;

  // 2b. Schedule warmup emails for all active warming mailboxes that haven't been enqueued
  if (hour >= 8 && hour <= 17 && dayOfWeek >= 1 && dayOfWeek <= 5) {
    const warmingMailboxes = await prisma.coldMailbox.findMany({
      where: { status: 'active', warmupEnabled: true, warmupStatus: 'warming' },
    });
    const warmupQueue = new (await import('bullmq')).Queue('mailbox-warmup', { connection: connection as never });
    const existingJobs = await warmupQueue.getWaiting();
    const enqueuedMailboxIds = new Set(existingJobs.map((j: any) => j.data?.mailboxId).filter(Boolean));
    let warmupEnqueued = 0;
    for (const mb of warmingMailboxes) {
      if (enqueuedMailboxIds.has(mb.id)) continue;
      if (mb.sentToday >= mb.dailySendLimit) continue;
      await warmupQueue.add('warmup', { mailboxId: mb.id, tenantId: mb.tenantId }, { delay: Math.floor(Math.random() * 300000) });
      warmupEnqueued++;
    }
    await warmupQueue.close();
    results.warmupEnqueued = warmupEnqueued;
  }

  // 3. Bounce monitoring — auto-pause mailboxes with bounce > 5%
  const activeMailboxes = await prisma.coldMailbox.findMany({ where: { status: 'active', totalSent: { gt: 50 } } });
  let paused = 0;
  for (const mb of activeMailboxes) {
    if (Number(mb.bounceRate) > 5) {
      await prisma.coldMailbox.update({ where: { id: mb.id }, data: { status: 'paused' } });
      if (mb.tenantId) {
        await prisma.notification.create({
          data: { tenantId: mb.tenantId, type: 'system', title: 'Mailbox Auto-Paused', body: `${mb.email} paused due to ${mb.bounceRate}% bounce rate`, metadata: { mailboxId: mb.id } },
        }).catch(() => undefined);
      }
      paused++;
    }
  }
  results.mailboxesPaused = paused;

  // 4. Domain health checks (every 6 hours)
  if (hour % 6 === 0) {
    const domains = await prisma.sendingDomain.findMany({ where: { healthScore: { gt: -1 } }, take: 20 });
    for (const domain of domains) {
      try {
        const dnsResolver = new Resolver();
        dnsResolver.setServers(['8.8.8.8', '1.1.1.1']);
        const hasMx = await dnsResolver.resolveMx(domain.domain).then(a => a.length > 0).catch(() => false);
        let score = hasMx ? 25 : 0;
        const hasTxt = await dnsResolver.resolveTxt(domain.domain).then(records => {
          const flat = records.map(r => r.join('')).join(' ');
          return flat.includes('v=spf1');
        }).catch(() => false);
        score += hasTxt ? 25 : 0;
        const hasDmarc = await dnsResolver.resolveTxt(`_dmarc.${domain.domain}`).then(records => {
          return records.some(r => r.join('').includes('v=DMARC1'));
        }).catch(() => false);
        score += hasDmarc ? 25 : 0;
        const dkimSelector = (domain as any).dkimSelector ?? 'default';
        const hasDkim = await dnsResolver.resolveTxt(`${dkimSelector}._domainkey.${domain.domain}`).then(records => {
          return records.some(r => r.join('').includes('v=DKIM1') || r.join('').includes('k=rsa'));
        }).catch(() => false);
        score += hasDkim ? 25 : 0;
        await prisma.sendingDomain.update({ where: { id: domain.id }, data: {
          healthScore: Math.min(score, 100),
          spfStatus: hasTxt ? 'verified' : 'not_set',
          dmarcStatus: hasDmarc ? 'verified' : 'not_set',
          mxStatus: hasMx ? 'verified' : 'not_set',
        } as any });
      } catch {}
    }
    results.healthChecked = domains.length;
  }

  // 5. Domain intelligence: age caps, auto-pause on low health, auto-recovery
  if (hour === 2) {
    const allDomains = await prisma.sendingDomain.findMany({ where: { purchasedAt: { not: null } } });
    for (const domain of allDomains) {
      // Young domain cap: limit daily sending for domains < 30 days old
      if (domain.purchasedAt) {
        const ageMs = now.getTime() - new Date(domain.purchasedAt).getTime();
        const ageDays = Math.floor(ageMs / 86400000);
        if (ageDays < 30 && domain.currentDailyCap !== 20) {
          await prisma.sendingDomain.update({ where: { id: domain.id }, data: { currentDailyCap: 20 } });
        } else if (ageDays >= 30 && domain.currentDailyCap === 20) {
          await prisma.sendingDomain.update({ where: { id: domain.id }, data: { currentDailyCap: 50 } });
        }
      }
      // Auto-pause domain with health < 70
      if (domain.healthScore < 70 && domain.tenantId) {
        await prisma.coldMailbox.updateMany({ where: { domainId: domain.id, status: 'active' }, data: { status: 'paused' } });
        await prisma.notification.create({
          data: { tenantId: domain.tenantId, type: 'domain_unhealthy', title: 'Domain Health Critical',
            body: `${domain.domain} health score dropped to ${domain.healthScore}. Mailboxes paused.`,
            metadata: { domainId: domain.id, healthScore: domain.healthScore } },
        }).catch(() => undefined);
      }
    }
    // Auto-recovery: restart warmup for mailboxes paused > 7 days with improved rates
    const pausedMailboxes = await prisma.coldMailbox.findMany({ where: { status: 'paused', updatedAt: { lt: new Date(now.getTime() - 7 * 86400000) } } });
    for (const mb of pausedMailboxes) {
      if (Number(mb.bounceRate) < 3) {
        await prisma.coldMailbox.update({ where: { id: mb.id }, data: { status: 'active', warmupStatus: 'warming', warmupEnabled: true, dailySendLimit: 5 } });
        const persona = await prisma.persona.findFirst({ where: { mailboxId: mb.id } });
        if (persona) {
          await prisma.persona.update({ where: { id: persona.id }, data: { warmupStatus: 'warming', warmupDay: 1, dailySendLimit: 5 } });
        }
      }
    }
    results.domainIntelligence = { domainsChecked: allDomains.length, recovered: pausedMailboxes.filter(mb => Number(mb.bounceRate) < 3).length };
  }

  // 5b. Recover email marketing campaigns stuck in 'sending' for > 30 minutes
  const stuckCutoff = new Date(now.getTime() - 30 * 60 * 1000);
  const stuckCampaigns = await prisma.emailCampaign.findMany({
    where: {
      status: CampaignStatus.sending,
      updatedAt: { lt: stuckCutoff },
      OR: [{ sendContinuationAt: null }, { sendContinuationAt: { lte: now } }],
    },
  });
  for (const sc of stuckCampaigns) {
    const remaining = await prisma.campaignRecipient.count({ where: { campaignId: sc.id, status: 'queued' } });
    const failedCount = await prisma.campaignRecipient.count({ where: { campaignId: sc.id, status: 'failed' } });
    const nextStatus = remaining > 0 ? CampaignStatus.partial_failed : failedCount > 0 ? CampaignStatus.partial_failed : CampaignStatus.sent;
    await prisma.emailCampaign.update({
      where: { id: sc.id },
      data: {
        status: nextStatus,
        completedAt: new Date(),
        lastError: remaining > 0 ? `Campaign recovered from stuck state — ${remaining} recipients unsent` : null,
      },
    });
    console.warn(`[RECOVERY] Campaign ${sc.id} was stuck in 'sending' since ${sc.updatedAt.toISOString()} — set to ${nextStatus}`);
  }
  results.stuckCampaignsRecovered = stuckCampaigns.length;

  // 6. Auto-pause stale draft campaigns (> 30 days)
  if (hour === 3) {
    const staleDate = new Date(now.getTime() - 30 * 86400000);
    const staleCampaigns = await prisma.coldCampaign.findMany({ where: { status: 'draft', createdAt: { lt: staleDate } } });
    for (const c of staleCampaigns) {
      if (c.tenantId) {
        await prisma.notification.create({
          data: { tenantId: c.tenantId, type: 'system', title: 'Stale Campaign', body: `"${c.name}" has been in draft for 30+ days. Consider activating or deleting it.`, metadata: { campaignId: c.id } },
        }).catch(() => undefined);
      }
    }
    results.staleCampaignsNotified = staleCampaigns.length;
  }

  // 6. Weekly performance digest (Monday 9am UTC)
  if (dayOfWeek === 1 && hour === 9) {
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const tenants = await prisma.tenant.findMany({ where: { status: 'active' }, select: { id: true } });
    for (const tenant of tenants) {
      const events = await prisma.coldEmailEvent.groupBy({
        by: ['type'],
        where: { campaign: { tenantId: tenant.id }, occurredAt: { gte: weekAgo } },
        _count: true,
      });
      const sent = events.find(e => e.type === 'sent')?._count ?? 0;
      const opened = events.find(e => e.type === 'opened')?._count ?? 0;
      const replied = events.find(e => e.type === 'replied')?._count ?? 0;
      if (sent > 0) {
        await prisma.notification.create({
          data: { tenantId: tenant.id, type: 'system', title: 'Weekly Outreach Report',
            body: `Last 7 days: ${sent} sent, ${opened} opens, ${replied} replies (${sent > 0 ? Math.round(replied / sent * 100) : 0}% reply rate)`,
            metadata: { sent, opened, replied, period: 'weekly' } },
        }).catch(() => undefined);
      }
    }
    results.weeklyDigestSent = tenants.length;
  }

  // 7. Unhandled reply reminders
  if (hour === 10) {
    const oneDayAgo = new Date(now.getTime() - 86400000);
    const unhandled = await prisma.coldReply.findMany({
      where: { respondedAt: null, receivedAt: { lt: oneDayAgo } },
    });
    for (const reply of unhandled) {
      await prisma.notification.create({
        data: { tenantId: reply.tenantId, type: 'reply_received', title: 'Unhandled Reply',
          body: `Reply from ${reply.fromEmail} has been waiting ${Math.round((now.getTime() - reply.receivedAt.getTime()) / 3600000)} hours`,
          metadata: { replyId: reply.id, fromEmail: reply.fromEmail } },
      }).catch(() => undefined);
    }
    results.unhandledReminders = unhandled.length;
  }

  // 8. Send scheduled reports
  const dueReports = await prisma.scheduledReport.findMany({
    where: { enabled: true, nextSendAt: { lte: now } },
  });
  for (const report of dueReports) {
    try {
      const campaigns = await prisma.emailCampaign.findMany({
        where: { tenantId: report.tenantId, status: { in: ['sent', 'partial_failed', 'sending'] } },
        select: { name: true, totalRecipients: true, openCount: true, clickCount: true, bounceCount: true, sentAt: true },
        orderBy: { createdAt: 'desc' }, take: 10,
      });
      const rows = campaigns.map(c =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee">${c.name}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${c.totalRecipients}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${c.totalRecipients > 0 ? ((c.openCount / c.totalRecipients) * 100).toFixed(1) : 0}%</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${c.totalRecipients > 0 ? ((c.clickCount / c.totalRecipients) * 100).toFixed(1) : 0}%</td></tr>`
      ).join('');
      const html = `<h2>Email Marketing Report — ${report.name}</h2><table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px"><thead><tr style="background:#f4f4f4"><th style="padding:8px;text-align:left">Campaign</th><th style="padding:8px;text-align:right">Recipients</th><th style="padding:8px;text-align:right">Open Rate</th><th style="padding:8px;text-align:right">Click Rate</th></tr></thead><tbody>${rows || '<tr><td colspan="4" style="padding:16px;text-align:center;color:#999">No campaigns to report</td></tr>'}</tbody></table>`;
      const domain = await prisma.sendingDomain.findFirst({ where: { tenantId: report.tenantId } });
      let delivered = 0;
      let lastError: string | null = null;
      for (const to of report.recipients) {
        try {
          await sendViaSendGrid({ tenantId: report.tenantId, to, fromEmail: `reports@${domain?.domain ?? 'example.com'}`, fromName: 'Email Marketing Reports', subject: `${report.name} - ${now.toLocaleDateString()}`, html }, prisma);
          delivered++;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }
      if (delivered === 0) {
        await prisma.scheduledReport.update({ where: { id: report.id }, data: { lastError: lastError ?? 'No report recipients were delivered' } });
        continue;
      }
      const delayMs = report.frequency === 'daily' ? 86400000 : report.frequency === 'weekly' ? 7 * 86400000 : 30 * 86400000;
      await prisma.scheduledReport.update({ where: { id: report.id }, data: { lastSentAt: now, nextSendAt: new Date(now.getTime() + delayMs), lastError: null } });
    } catch {}
  }
  results.reportsSent = dueReports.length;

  // Re-enqueue self for next hour (use jobId to prevent duplicates if crash recovery also enqueues)
  const cronQueue = new (await import('bullmq')).Queue('system-cron', { connection: connection as never });
  await cronQueue.add('hourly', {}, { delay: 3600000, jobId: `cron-hourly-${Date.now()}` });
  await cronQueue.close();

  return { processed: true, ...results };
}

// ── Email Automation Drip Engine ───────────────────────────────────────

async function assertAutomationEmailSendable(input: {
  tenantId: string;
  contactId: string;
  contactEmail: string;
  subject: string;
  body: string;
  fromEmail: string;
  companyAddress?: string;
}) {
  if (!input.fromEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.fromEmail)) throw new Error('Valid sender email is required');
  if (!input.subject.trim()) throw new Error('Subject is required');
  if (!input.body.trim()) throw new Error('Body is required');
  if (!input.companyAddress?.trim()) throw new Error('Company address is required');
  const warnings = contentQaWarnings({ subject: input.subject, body: input.body });
  const blocking = warnings.find((warning) => warning.severity === 'error');
  if (blocking) throw new Error(blocking.label);
  const domainName = input.fromEmail.split('@')[1]?.toLowerCase();
  const domain = domainName ? await prisma.sendingDomain.findFirst({ where: { tenantId: input.tenantId, domain: domainName } }) : null;
  const verified = !!domain && [domain.spfStatus, domain.dkimStatus, domain.mxStatus, domain.dmarcStatus].every((status) => status === DnsRecordStatus.verified);
  if (!verified) throw new Error('Sender domain must be verified');
  const contact = await prisma.contact.findFirst({ where: { tenantId: input.tenantId, id: input.contactId, email: input.contactEmail.toLowerCase(), marketingConsent: true } });
  if (!contact) throw new Error('Contact is missing marketing consent');
  const suppression = await prisma.suppressionEntry.findUnique({ where: { tenantId_email: { tenantId: input.tenantId, email: input.contactEmail.toLowerCase() } } });
  if (suppression) throw new Error('Contact is suppressed');
}

async function processAutomationTick(data: Record<string, unknown>) {
  const payload = (data.payload && typeof data.payload === 'object') ? data.payload as Record<string, unknown> : data;
  const executionId = payload.executionId as string | undefined;

  const executions = executionId
    ? await prisma.automationExecution.findMany({ where: { id: executionId, status: 'active' } })
    : await prisma.automationExecution.findMany({ where: { status: 'active', nextRunAt: { lte: new Date() } }, take: 50 });

  let processed = 0;
  for (const exec of executions) {
    if (!exec.currentStepId) { await prisma.automationExecution.update({ where: { id: exec.id }, data: { status: 'completed', completedAt: new Date() } }); continue; }

    const step = await prisma.automationStep.findUnique({ where: { id: exec.currentStepId } });
    if (!step) { await prisma.automationExecution.update({ where: { id: exec.id }, data: { status: 'completed', completedAt: new Date() } }); continue; }

    const automation = await prisma.emailAutomation.findUnique({ where: { id: exec.automationId } });
    if (!automation || automation.status !== 'active') continue;

    try {
      if (step.type === 'send_email') {
        const config = step.config as Record<string, unknown>;
        const subject = (config.subject as string) ?? 'No subject';
        const body = (config.body as string) ?? '';
        const fromEmail = (config.fromEmail as string) ?? '';
        const fromName = (config.fromName as string) ?? '';
        if (fromEmail && body) {
          await assertAutomationEmailSendable({
            tenantId: automation.tenantId,
            contactId: exec.contactId,
            contactEmail: exec.contactEmail,
            subject,
            body,
            fromEmail,
            companyAddress: config.companyAddress as string | undefined,
          });
          const contact = await prisma.contact.findUnique({ where: { id: exec.contactId } });
          const mergedBody = body
            .replace(/\{\{firstName\}\}/g, contact?.firstName ?? '')
            .replace(/\{\{lastName\}\}/g, contact?.lastName ?? '')
            .replace(/\{\{email\}\}/g, exec.contactEmail)
            .replace(/\{\{companyName\}\}/g, fromName);
          const rendered = await renderEmailWithTracking({
            store: prisma, body: mergedBody, tenantId: automation.tenantId,
            campaignId: `automation-${automation.id}`, recipientId: exec.contactId,
            email: exec.contactEmail, trackOpens: true, trackClicks: true,
            companyAddress: config.companyAddress as string, subject,
          });
          await sendViaSendGrid({
            tenantId: automation.tenantId, to: exec.contactEmail,
            fromEmail, fromName, subject, html: rendered?.html ?? mergedBody,
            text: htmlToPlainText(mergedBody), unsubscribeUrl: rendered?.unsubscribeUrl,
          }, prisma);
        }
      } else if (step.type === 'wait_delay') {
        const config = step.config as Record<string, unknown>;
        const delayMs = ((config.days as number) ?? 1) * 86400000 + ((config.hours as number) ?? 0) * 3600000;
        if (!exec.nextRunAt || exec.nextRunAt.getTime() > Date.now() - delayMs) {
          await prisma.automationExecution.update({ where: { id: exec.id }, data: { nextRunAt: new Date(Date.now() + delayMs) } });
          continue;
        }
      } else if (step.type === 'add_tag') {
        const config = step.config as Record<string, unknown>;
        const tag = config.tag as string;
        if (tag) {
          const contact = await prisma.contact.findUnique({ where: { id: exec.contactId } });
          if (contact && !contact.tags.includes(tag)) {
            await prisma.contact.update({ where: { id: exec.contactId }, data: { tags: { push: tag } } });
          }
        }
      } else if (step.type === 'remove_tag') {
        const config = step.config as Record<string, unknown>;
        const tag = config.tag as string;
        if (tag) {
          const contact = await prisma.contact.findUnique({ where: { id: exec.contactId } });
          if (contact) {
            await prisma.contact.update({ where: { id: exec.contactId }, data: { tags: { set: contact.tags.filter(t => t !== tag) } } });
          }
        }
      }

      const nextStep = await prisma.automationStep.findFirst({
        where: { automationId: exec.automationId, stepOrder: { gt: step.stepOrder } },
        orderBy: { stepOrder: 'asc' },
      });
      if (nextStep) {
        const nextDelay = nextStep.type === 'wait_delay' ? (((nextStep.config as any)?.days ?? 1) * 86400000) : 0;
        await prisma.automationExecution.update({
          where: { id: exec.id },
          data: { currentStepId: nextStep.id, nextRunAt: new Date(Date.now() + nextDelay) },
        });
      } else {
        await prisma.automationExecution.update({ where: { id: exec.id }, data: { status: 'completed', completedAt: new Date(), currentStepId: null } });
        await prisma.emailAutomation.update({ where: { id: exec.automationId }, data: { completedCount: { increment: 1 } } });
      }
      processed++;
    } catch (error) {
      await prisma.automationExecution.update({
        where: { id: exec.id },
        data: { status: 'failed', completedAt: new Date(), lastError: error instanceof Error ? error.message : String(error) },
      });
    }
  }
  return { processed: true, executionsProcessed: processed };
}

const handlers: Record<string, (data: Record<string, unknown>) => Promise<Record<string, unknown>>> = {
  'email-campaigns': processEmailCampaign,
  'cold-email-sequences': processColdSequenceTick,
  'mailbox-warmup': processMailboxWarmup,
  'domain-purchase-pipeline': processDomainPurchasePipeline,
  'system-cron': processSystemCron,
  'email-automations': processAutomationTick,
  'notifications': processNotification,
  'dns-checks': processDnsCheck,
};

const queues = [
  'email-campaigns',
  'cold-email-sequences',
  'mailbox-warmup',
  'domain-purchase-pipeline',
  'system-cron',
  'provider-sync',
  'dns-checks',
  'email-automations',
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

// Bootstrap system cron on startup — always ensure a cron job exists (crash recovery)
(async () => {
  const { Queue } = await import('bullmq');
  const cronQueue = new Queue('system-cron', { connection: connection as never });
  const [waiting, delayed] = await Promise.all([cronQueue.getWaiting(), cronQueue.getDelayed()]);
  if (waiting.length === 0 && delayed.length === 0) {
    await cronQueue.add('hourly', {}, { delay: 60000 });
    console.log('[CRON] System cron bootstrapped — first run in 60s');
  }
  await cronQueue.close();
})().catch((err) => console.error('[CRON] Failed to bootstrap system cron:', err));

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  await connection.quit();
  process.exit(0);
});

