import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingController, StripeWebhookController } from './billing.controller';
import { BillingService } from './billing.service';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [PrismaModule, ProvidersModule, AuthModule],
  controllers: [BillingController, StripeWebhookController],
  providers: [BillingService],
})
export class BillingModule {}
