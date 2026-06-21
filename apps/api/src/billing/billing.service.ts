import { BadRequestException, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { BillingSubscriptionStatus, PlanKey, TenantStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderLogsService } from '../providers/services/provider-logs.service';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logs: ProviderLogsService,
  ) {}

  async getSubscription(tenantId: string) {
    const [tenant, subscription] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId }, include: { enabledServices: true } }),
      this.prisma.billingSubscription.findFirst({ where: { tenantId }, orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      tenantStatus: tenant?.status,
      plan: tenant?.plan,
      seats: tenant?.seats,
      enabledServices: tenant?.enabledServices.map((service) => service.key) ?? [],
      stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
      subscription,
    };
  }

  listInvoices(tenantId: string) {
    return this.prisma.invoice.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  listPaymentMethods(tenantId: string) {
    return this.prisma.paymentMethodRef.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  }

  usage(tenantId: string, query: Record<string, string>) {
    return this.prisma.usageRecord.findMany({
      where: { tenantId, ...(query.period ? { period: query.period } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async createCheckout(tenantId: string, body: Record<string, unknown>) {
    const apiKey = this.requireStripe();
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException('Tenant not found');
    const price = this.requiredString(body.priceId, 'priceId');
    const appUrl = process.env.APP_PUBLIC_URL ?? 'http://localhost:5173';
    const payload = new URLSearchParams({
      mode: 'subscription',
      success_url: this.optionalString(body.successUrl) ?? `${appUrl}/settings?billing=success`,
      cancel_url: this.optionalString(body.cancelUrl) ?? `${appUrl}/settings?billing=cancelled`,
      'line_items[0][price]': price,
      'line_items[0][quantity]': String(tenant.seats),
      client_reference_id: tenantId,
      customer_email: tenant.email,
    });
    const response = await this.stripe('/v1/checkout/sessions', apiKey, payload);
    await this.logs.create({ tenantId, provider: 'stripe', operation: 'checkout_session', status: 'success', response });
    return { url: response.url, id: response.id };
  }

  async createPortal(tenantId: string, body: Record<string, unknown>) {
    const apiKey = this.requireStripe();
    const subscription = await this.prisma.billingSubscription.findFirst({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
    if (!subscription?.stripeCustomerId) throw new BadRequestException('Stripe customer is not linked');
    const appUrl = process.env.APP_PUBLIC_URL ?? 'http://localhost:5173';
    const response = await this.stripe('/v1/billing_portal/sessions', apiKey, new URLSearchParams({
      customer: subscription.stripeCustomerId,
      return_url: this.optionalString(body.returnUrl) ?? `${appUrl}/settings`,
    }));
    await this.logs.create({ tenantId, provider: 'stripe', operation: 'billing_portal', status: 'success', response });
    return { url: response.url, id: response.id };
  }

  verifyWebhookSignature(rawBody: string, signature: string) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return;
    const parts = signature.split(',').reduce((acc, part) => {
      const [k, v] = part.split('=');
      if (k && v) acc[k] = v;
      return acc;
    }, {} as Record<string, string>);
    const timestamp = parts.t;
    const sig = parts.v1;
    if (!timestamp || !sig) throw new BadRequestException('Invalid Stripe signature format');
    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (age > 300) throw new BadRequestException('Stripe webhook timestamp too old');
    const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
    const sigBuffer = Buffer.from(sig, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      throw new BadRequestException('Stripe webhook signature mismatch');
    }
  }

  async handleStripeWebhook(body: Record<string, unknown>) {
    const type = String(body.type ?? '');
    const stripeEventId = typeof body.id === 'string' ? body.id : undefined;
    if (stripeEventId) {
      const existing = await this.prisma.providerLog.findFirst({
        where: { provider: 'stripe', requestId: stripeEventId },
      });
      if (existing) return { processed: false, reason: 'duplicate event' };
    }
    const object = (body.data as Record<string, unknown> | undefined)?.object as Record<string, unknown> | undefined;
    if (!object) return { processed: false };

    if (type.startsWith('customer.subscription.')) {
      const metadata = (object.metadata && typeof object.metadata === 'object' ? object.metadata : {}) as Record<string, unknown>;
      const tenantId = String(object.client_reference_id ?? metadata.tenantId ?? '');
      if (!tenantId) return { processed: false, reason: 'tenant metadata missing' };
      const status = this.mapStripeStatus(String(object.status ?? 'incomplete'));
      await this.prisma.billingSubscription.upsert({
        where: { stripeSubscriptionId: String(object.id) },
        update: {
          status,
          stripeCustomerId: String(object.customer ?? ''),
          currentPeriodStart: this.fromUnix(object.current_period_start),
          currentPeriodEnd: this.fromUnix(object.current_period_end),
          cancelAtPeriodEnd: Boolean(object.cancel_at_period_end),
        },
        create: {
          tenantId,
          stripeSubscriptionId: String(object.id),
          stripeCustomerId: String(object.customer ?? ''),
          plan: PlanKey.starter,
          status,
          currentPeriodStart: this.fromUnix(object.current_period_start),
          currentPeriodEnd: this.fromUnix(object.current_period_end),
        },
      });
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { status: status === BillingSubscriptionStatus.past_due ? TenantStatus.payment_failed : TenantStatus.active },
      });
      if (stripeEventId) await this.logs.create({ tenantId, provider: 'stripe', operation: type, status: 'success', requestId: stripeEventId });
      return { processed: true };
    }

    if (type === 'invoice.payment_failed') {
      const metadata = (object.metadata && typeof object.metadata === 'object' ? object.metadata : {}) as Record<string, unknown>;
      const tenantId = String(metadata.tenantId ?? '');
      if (tenantId) await this.prisma.tenant.update({ where: { id: tenantId }, data: { status: TenantStatus.payment_failed } });
      if (stripeEventId) await this.logs.create({ tenantId: tenantId || undefined, provider: 'stripe', operation: type, status: 'success', requestId: stripeEventId });
      return { processed: true };
    }

    return { processed: false, type };
  }

  private async stripe(path: string, apiKey: string, body: URLSearchParams) {
    const response = await fetch(`https://api.stripe.com${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new BadRequestException(`Stripe request failed: ${JSON.stringify(payload)}`);
    return payload;
  }

  private requireStripe() {
    if (!process.env.STRIPE_SECRET_KEY) throw new BadRequestException('Stripe is not configured');
    return process.env.STRIPE_SECRET_KEY;
  }

  private mapStripeStatus(status: string): BillingSubscriptionStatus {
    if (status === 'active') return BillingSubscriptionStatus.active;
    if (status === 'trialing') return BillingSubscriptionStatus.trialing;
    if (status === 'past_due') return BillingSubscriptionStatus.past_due;
    if (status === 'canceled') return BillingSubscriptionStatus.canceled;
    if (status === 'unpaid') return BillingSubscriptionStatus.unpaid;
    return BillingSubscriptionStatus.incomplete;
  }

  private fromUnix(value: unknown) {
    return typeof value === 'number' ? new Date(value * 1000) : undefined;
  }

  private requiredString(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${field} is required`);
    return value.trim();
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
