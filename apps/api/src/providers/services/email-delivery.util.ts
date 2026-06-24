import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

export type SendGridInput = {
  tenantId: string;
  campaignId?: string;
  recipientId?: string;
  to: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  html?: string | null;
  text?: string | null;
  replyTo?: string | null;
  unsubscribeUrl?: string;
  ipPool?: string;
  trackingArgs?: Record<string, string>;
};

export type SendGridLogStore = {
  providerLog: {
    create: (args: { data: Prisma.ProviderLogUncheckedCreateInput }) => Promise<unknown>;
  };
};

export async function sendViaSendGrid(input: SendGridInput, store?: SendGridLogStore) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') throw new Error('SENDGRID_API_KEY is not configured');
    console.warn(`[EMAIL-SIM] SENDGRID_API_KEY not set — email to ${input.to} was SIMULATED, not actually sent (campaign: ${input.campaignId ?? 'n/a'})`);
    const requestId = `local-${Date.now()}`;
    await store?.providerLog.create({
      data: {
        tenantId: input.tenantId,
        provider: 'local',
        operation: 'send_email',
        status: 'success',
        requestId,
        request: { to: input.to, campaignId: input.campaignId } as Prisma.InputJsonObject,
        response: { delivered: false, reason: 'SENDGRID_API_KEY not configured; local development send simulated' } as Prisma.InputJsonObject,
      },
    }).catch(() => undefined);
    return { provider: 'local', requestId, simulated: true };
  }
  const payload: Record<string, unknown> = {
    personalizations: [{
      to: [{ email: input.to }],
      custom_args: {
        ...(input.trackingArgs ?? {}),
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
        ...(input.campaignId ? { campaignId: input.campaignId } : {}),
        ...(input.recipientId ? { recipientId: input.recipientId } : {}),
      },
    }],
    from: { email: input.fromEmail, name: input.fromName },
    reply_to: input.replyTo ? { email: input.replyTo } : undefined,
    subject: input.subject,
    content: [
      ...(input.text ? [{ type: 'text/plain', value: input.text }] : []),
      ...(input.html ? [{ type: 'text/html', value: input.html }] : []),
    ],
    ...(input.unsubscribeUrl ? {
      headers: {
        'List-Unsubscribe': `<${input.unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    } : {}),
    ...(input.ipPool ? { ip_pool_name: input.ipPool } : {}),
    tracking_settings: {
      click_tracking: { enable: true, enable_text: true },
      open_tracking: { enable: true },
      subscription_tracking: { enable: false },
    },
  };
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': randomUUID() },
    body: JSON.stringify(payload),
  });
  const requestId = response.headers.get('x-message-id') ?? undefined;
  if (!response.ok) throw new Error(await response.text());
  await store?.providerLog.create({
    data: {
      tenantId: input.tenantId,
      provider: 'sendgrid',
      operation: 'send_email',
      status: 'success',
      requestId,
      request: { to: input.to, campaignId: input.campaignId } as Prisma.InputJsonObject,
      response: { status: response.status } as Prisma.InputJsonObject,
    },
  }).catch(() => undefined);
  return { provider: 'sendgrid', requestId };
}
