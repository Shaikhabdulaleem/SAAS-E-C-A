import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingController, StripeWebhookController } from './billing.controller';
import { BillingService } from './billing.service';
import { DunningService } from './dunning.service';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [PrismaModule, ProvidersModule, AuthModule],
  controllers: [BillingController, StripeWebhookController],
  providers: [BillingService, DunningService],
  exports: [DunningService],
})
export class BillingModule {}
