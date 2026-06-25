import { Injectable } from '@nestjs/common';
import { TenantStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { logger } from '../common/logger';

interface DunningStep {
  daysSinceFailure: number;
  subject: string;
  bodyHtml: (companyName: string, daysSince: number) => string;
  suspend: boolean;
}

const DUNNING_STEPS: DunningStep[] = [
  {
    daysSinceFailure: 1,
    subject: 'Action required: Payment failed for your NexusHQ subscription',
    bodyHtml: (name) => `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2>Payment failed</h2>
        <p>Hi ${name},</p>
        <p>We were unable to process your latest payment. Please update your payment method to avoid service interruption.</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="{{APP_URL}}/settings" style="background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">Update Payment Method</a>
        </p>
        <p style="font-size: 13px; color: #6b7280;">If you've already updated your payment, please disregard this email.</p>
      </div>`,
    suspend: false,
  },
  {
    daysSinceFailure: 3,
    subject: 'Reminder: Your NexusHQ payment is overdue',
    bodyHtml: (name) => `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2>Payment still pending</h2>
        <p>Hi ${name},</p>
        <p>This is a reminder that your payment is still outstanding. Your account may be restricted if not resolved within the next few days.</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="{{APP_URL}}/settings" style="background: #dc2626; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">Update Payment Now</a>
        </p>
      </div>`,
    suspend: false,
  },
  {
    daysSinceFailure: 7,
    subject: 'Final notice: Your NexusHQ account will be suspended',
    bodyHtml: (name) => `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2>Account suspension imminent</h2>
        <p>Hi ${name},</p>
        <p>Your payment has been overdue for 7 days. <strong>Your account will be suspended today</strong> unless payment is resolved.</p>
        <p>All your data is safe and will be preserved. Once payment is updated, your account will be fully restored.</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="{{APP_URL}}/settings" style="background: #dc2626; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">Resolve Payment</a>
        </p>
      </div>`,
    suspend: true,
  },
];

@Injectable()
export class DunningService {
  constructor(private readonly prisma: PrismaService) {}

  async processDunning() {
    const failedTenants = await this.prisma.tenant.findMany({
      where: { status: TenantStatus.payment_failed },
    });

    let processed = 0;
    const appUrl = process.env.APP_PUBLIC_URL ?? 'http://localhost:5173';

    for (const tenant of failedTenants) {
      const daysSinceFailure = Math.floor((Date.now() - tenant.updatedAt.getTime()) / 86_400_000);

      const step = DUNNING_STEPS.find((s) => s.daysSinceFailure === daysSinceFailure);
      if (!step) continue;

      const html = step.bodyHtml(tenant.companyName, daysSinceFailure).replace(/\{\{APP_URL\}\}/g, appUrl);
      await this.sendDunningEmail(tenant.email, step.subject, html);

      await this.prisma.auditLog.create({
        data: {
          tenantId: tenant.id,
          actorUserId: 'system',
          event: 'billing.dunning.sent',
          metadata: { step: step.daysSinceFailure, email: tenant.email, suspend: step.suspend },
        },
      });

      if (step.suspend) {
        await this.prisma.tenant.update({
          where: { id: tenant.id },
          data: { status: TenantStatus.suspended, mrr: 0 },
        });
        logger.warn('tenant_suspended_dunning', { tenantId: tenant.id, companyName: tenant.companyName });
      }

      processed++;
    }

    logger.info('dunning_cycle_complete', { failedTenants: failedTenants.length, processed });
    return { failedTenants: failedTenants.length, processed };
  }

  private async sendDunningEmail(to: string, subject: string, html: string) {
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SYSTEM_FROM_EMAIL ?? 'billing@nexushq.io';
    const fromName = process.env.SYSTEM_FROM_NAME ?? 'NexusHQ Billing';

    if (!apiKey) {
      logger.warn('dunning_email_simulated', { to, subject });
      return;
    }

    try {
      await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: fromEmail, name: fromName },
          subject,
          content: [{ type: 'text/html', value: html }],
        }),
      });
    } catch (error) {
      logger.error('dunning_email_failed', { to, error: error instanceof Error ? error.message : String(error) });
    }
  }
}
