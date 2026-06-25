import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ActivitiesController, CompaniesController, ContactsController, CrmAutomationController, DealsController, PipelineStagesController, TagsController } from './crm.controller';
import { CrmService } from './crm.service';
import { CrmAutomationService } from './crm-automation.service';

@Module({
  imports: [AuthModule],
  controllers: [ContactsController, CompaniesController, DealsController, ActivitiesController, PipelineStagesController, TagsController, CrmAutomationController],
  providers: [CrmService, CrmAutomationService],
  exports: [CrmAutomationService],
})
export class CrmModule {}
