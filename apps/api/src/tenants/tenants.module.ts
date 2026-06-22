import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminAuditController } from './admin-audit.controller';
import { AdminTenantExtrasController } from './admin-tenant-extras.controller';
import { AdminTenantExtrasService } from './admin-tenant-extras.service';
import { AdminBillingOverviewController } from './admin-billing-overview.controller';
import { AdminNotificationsController } from './admin-notifications.controller';
import { AdminNotificationsService } from './admin-notifications.service';
import { AdminColdEmailController } from './admin-cold-email.controller';
import { AdminColdEmailService } from './admin-cold-email.service';
import { AdminActivityFeedController } from './admin-activity-feed.controller';
import { AdminActivityFeedService } from './admin-activity-feed.service';
import { AdminAiUsageController } from './admin-ai-usage.controller';
import { AdminAiUsageService } from './admin-ai-usage.service';
import { AdminDomainPurchasesController } from './admin-domain-purchases.controller';
import { AdminDomainPurchasesService } from './admin-domain-purchases.service';
import { AdminCallAnalyticsController } from './admin-call-analytics.controller';
import { AdminCallAnalyticsService } from './admin-call-analytics.service';
import { AdminQuotasController } from './admin-quotas.controller';
import { AdminQuotasService } from './admin-quotas.service';
import { AdminOnboardingTemplatesController } from './admin-onboarding-templates.controller';
import { AdminOnboardingTemplatesService } from './admin-onboarding-templates.service';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminSettingsService } from './admin-settings.service';
import { AdminContractsController } from './admin-contracts.controller';
import { AdminContractsService } from './admin-contracts.service';
import { AdminNpsController } from './admin-nps.controller';
import { AdminNpsService } from './admin-nps.service';
import { AdminFeatureFlagsController } from './admin-feature-flags.controller';
import { AdminFeatureFlagsService } from './admin-feature-flags.service';
import { AdminAlertsController } from './admin-alerts.controller';
import { AdminAlertsService } from './admin-alerts.service';
import { AdminBenchmarksController } from './admin-benchmarks.controller';
import { AdminBenchmarksService } from './admin-benchmarks.service';
import { AdminFinanceSettingsController } from './admin-finance-settings.controller';
import { AdminFinanceSettingsService } from './admin-finance-settings.service';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { EncryptionService } from './encryption.service';

@Module({
  imports: [AuthModule],
  controllers: [
    TenantsController,
    AdminDashboardController,
    AdminAuditController,
    AdminTenantExtrasController,
    AdminBillingOverviewController,
    AdminNotificationsController,
    AdminColdEmailController,
    AdminActivityFeedController,
    AdminAiUsageController,
    AdminDomainPurchasesController,
    AdminCallAnalyticsController,
    AdminQuotasController,
    AdminOnboardingTemplatesController,
    AdminSettingsController,
    AdminContractsController,
    AdminNpsController,
    AdminFeatureFlagsController,
    AdminAlertsController,
    AdminBenchmarksController,
    AdminFinanceSettingsController,
  ],
  providers: [
    TenantsService,
    EncryptionService,
    AdminDashboardService,
    AdminTenantExtrasService,
    AdminNotificationsService,
    AdminColdEmailService,
    AdminActivityFeedService,
    AdminAiUsageService,
    AdminDomainPurchasesService,
    AdminCallAnalyticsService,
    AdminQuotasService,
    AdminOnboardingTemplatesService,
    AdminSettingsService,
    AdminContractsService,
    AdminNpsService,
    AdminFeatureFlagsService,
    AdminAlertsService,
    AdminBenchmarksService,
    AdminFinanceSettingsService,
  ],
})
export class TenantsModule {}
