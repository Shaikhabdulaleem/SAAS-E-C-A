import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProviderLogsService } from './provider-logs.service';
import { sendViaSendGrid } from './email-delivery.util';

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
  unsubscribeUrl?: string;
  trackingArgs?: Record<string, string>;
}

@Injectable()
export class EmailDeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logs: ProviderLogsService,
  ) {}

  async send(input: EmailSendInput) {
    try {
      const result = await sendViaSendGrid(input, this.prisma);
      if (input.campaignId) {
        await this.prisma.emailEvent.create({
          data: {
            campaignId: input.campaignId,
            type: 'delivered',
            providerId: result.requestId,
          },
        }).catch(() => undefined);
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.logs.create({
        tenantId: input.tenantId,
        provider: 'sendgrid',
        operation: 'send_email',
        status: 'failed',
        request: { to: input.to, campaignId: input.campaignId },
        error: message,
      });
      if (message === 'SENDGRID_API_KEY is not configured') throw new BadRequestException('SendGrid is not configured');
      throw new BadRequestException(`SendGrid rejected the email: ${message}`);
    }
  }
}
