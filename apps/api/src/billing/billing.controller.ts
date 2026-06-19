import { BadRequestException, Body, Controller, Get, Headers, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { resolveTenantId } from '../common/tenant-context';
import { BillingService } from './billing.service';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('subscription')
  subscription(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.billing.getSubscription(resolveTenantId(user, selectedTenantId));
  }

  @Get('invoices')
  invoices(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.billing.listInvoices(resolveTenantId(user, selectedTenantId));
  }

  @Get('payment-methods')
  paymentMethods(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.billing.listPaymentMethods(resolveTenantId(user, selectedTenantId));
  }

  @Post('checkout')
  checkout(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.billing.createCheckout(resolveTenantId(user, selectedTenantId), body);
  }

  @Post('portal')
  portal(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.billing.createPortal(resolveTenantId(user, selectedTenantId), body);
  }

  @Get('usage')
  usage(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.billing.usage(resolveTenantId(user, selectedTenantId), query);
  }
}

@Controller('billing/webhooks')
export class StripeWebhookController {
  constructor(private readonly billing: BillingService) {}

  @Post('stripe')
  stripe(@Body() body: Record<string, unknown>, @Headers('stripe-signature') signature?: string, @Req() req?: { rawBody?: string }) {
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      if (!signature) throw new BadRequestException('Stripe signature is required');
      this.billing.verifyWebhookSignature(req?.rawBody ?? JSON.stringify(body), signature);
    }
    return this.billing.handleStripeWebhook(body);
  }
}
