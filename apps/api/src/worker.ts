import 'reflect-metadata';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { CampaignStatus, DnsRecordStatus, EmailEventType, JobStatus, PrismaClient } from '@prisma/client';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';

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

    const subject = renderTemplate(currentStep.subject ?? '');
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

  const firstNames = ['James', 'Sarah', 'Michael', 'Emily', 'David', 'Jessica', 'Robert', 'Ashley', 'John', 'Amanda'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor'];
  let created = 0;

  for (const d of domains) {
    if (!d.sendingDomainId || d.mailboxStatus !== 'pending') continue;
    try {
      const fi = Math.floor(Math.random() * firstNames.length);
      const li = Math.floor(Math.random() * lastNames.length);
      const firstName = firstNames[fi]; const lastName = lastNames[li];
      const format = order.emailFormat ?? 'firstname.lastname';
      let localPart = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
      if (format === 'firstname') localPart = firstName.toLowerCase();
      else if (format === 'firstnamelastname') localPart = `${firstName.toLowerCase()}${lastName.toLowerCase()}`;
      else if (format === 'f.lastname') localPart = `${firstName[0].toLowerCase()}.${lastName.toLowerCase()}`;
      const email = `${localPart}@${d.domain}`;
      const tempPassword = randomBytes(9).toString('base64url') + '!A1';

      const tokenRes = await fetch(`https://login.microsoftonline.com/${msTenantId}/oauth2/v2.0/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope: 'https://graph.microsoft.com/.default' }),
      });
      const tokenData = await tokenRes.json() as any;
      if (!tokenData.access_token) { d.mailboxStatus = 'failed'; d.mailboxError = 'Failed to get M365 token'; continue; }

      const userRes = await fetch('https://graph.microsoft.com/v1.0/users', {
        method: 'POST', headers: { Authorization: `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountEnabled: true, displayName: `${firstName} ${lastName}`, mailNickname: localPart.replace('.', ''),
          userPrincipalName: email, passwordProfile: { password: tempPassword, forceChangePasswordNextSignIn: true },
          usageLocation: 'US',
        }),
      });
      const userData = await userRes.json() as any;
      if (!userRes.ok) { d.mailboxStatus = 'failed'; d.mailboxError = userData?.error?.message ?? 'M365 user creation failed'; continue; }

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

      d.mailboxStatus = 'created';
      created++;
    } catch (err) {
      d.mailboxStatus = 'failed';
      d.mailboxError = err instanceof Error ? err.message : 'Mailbox creation failed';
    }
    await prisma.domainPurchaseOrder.update({ where: { id: order.id }, data: { domains: domains } });
    await new Promise((r) => setTimeout(r, 3000));
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

const handlers: Record<string, (data: Record<string, unknown>) => Promise<Record<string, unknown>>> = {
  'email-campaigns': processEmailCampaign,
  'cold-email-sequences': processColdSequenceTick,
  'mailbox-warmup': processMailboxWarmup,
  'domain-purchase-pipeline': processDomainPurchasePipeline,
  'notifications': processNotification,
  'dns-checks': processDnsCheck,
};

const queues = [
  'email-campaigns',
  'cold-email-sequences',
  'mailbox-warmup',
  'domain-purchase-pipeline',
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
