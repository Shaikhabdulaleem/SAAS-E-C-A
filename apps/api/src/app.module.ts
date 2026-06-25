import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TenantsModule } from './tenants/tenants.module';
import { CrmModule } from './crm/crm.module';
import { EmailModule } from './email/email.module';
import { ColdEmailModule } from './cold-email/cold-email.module';
import { ProvisioningModule } from './provisioning/provisioning.module';
import { AiModule } from './ai/ai.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ProvidersModule } from './providers/providers.module';
import { BillingModule } from './billing/billing.module';
import { TeamModule } from './team/team.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OperationsModule } from './operations/operations.module';
import { CallsModule } from './calls/calls.module';
import { PricingModule } from './pricing/pricing.module';
import { ProposalsModule } from './proposals/proposals.module';
import { FinanceModule } from './finance/finance.module';
import { OpenApiController } from './common/openapi.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    CrmModule,
    EmailModule,
    ColdEmailModule,
    ProvisioningModule,
    AiModule,
    DashboardModule,
    ProvidersModule,
    BillingModule,
    TeamModule,
    OnboardingModule,
    NotificationsModule,
    OperationsModule,
    CallsModule,
    PricingModule,
    ProposalsModule,
    FinanceModule,
  ],
  controllers: [OpenApiController],
})
export class AppModule {}
