import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProviderLogsService } from './provider-logs.service';

export interface EmailSendInput {
  tenantId: string;
  campaignId?: string;
  to: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  html?: string | null;
  text?: string | null;
  replyTo?: string | null;
  trackingArgs?: Record<string, string>;
}

@Injectable()
export class EmailDeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logs: ProviderLogsService,
  ) {}

  async send(input: EmailSendInput) {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      await this.logs.create({
        tenantId: input.tenantId,
        provider: 'sendgrid',
        operation: 'send_email',
        status: 'failed',
        request: { to: input.to, campaignId: input.campaignId },
        error: 'SENDGRID_API_KEY is not configured',
      });
      throw new BadRequestException('SendGrid is not configured');
    }

    const payload = {
      personalizations: [{
        to: [{ email: input.to }],
        custom_args: input.trackingArgs ?? {},
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
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const requestId = response.headers.get('x-message-id') ?? undefined;
    if (!response.ok) {
      const error = await response.text();
      await this.logs.create({
        tenantId: input.tenantId,
        provider: 'sendgrid',
        operation: 'send_email',
        status: 'failed',
        requestId,
        request: { to: input.to, campaignId: input.campaignId },
        error,
      });
      throw new BadRequestException(`SendGrid rejected the email: ${error}`);
    }

    await this.logs.create({
      tenantId: input.tenantId,
      provider: 'sendgrid',
      operation: 'send_email',
      status: 'success',
      requestId,
      request: { to: input.to, campaignId: input.campaignId },
      response: { status: response.status },
    });

    if (input.campaignId) {
      await this.prisma.emailEvent.create({
        data: {
          campaignId: input.campaignId,
          type: 'delivered',
          providerId: requestId,
        },
      }).catch(() => undefined);
    }

    return { provider: 'sendgrid', requestId };
  }
}
