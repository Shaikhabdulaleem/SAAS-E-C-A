import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProvidersModule } from '../providers/providers.module';
import { EmailController, EmailDomainsController, EmailEventsController, EmailWebhookController, SuppressionsController, TemplatesController, ComplianceController, ScheduledReportsController } from './email.controller';
import { EmailService } from './email.service';
import { EmailAutomationController, EmailSegmentController } from './email-automation.controller';
import { EmailAutomationService } from './email-automation.service';

@Module({
  imports: [AuthModule, ProvidersModule],
  controllers: [EmailController, EmailDomainsController, TemplatesController, SuppressionsController, EmailEventsController, EmailWebhookController, EmailAutomationController, EmailSegmentController, ComplianceController, ScheduledReportsController],
  providers: [EmailService, EmailAutomationService],
})
export class EmailModule {}
