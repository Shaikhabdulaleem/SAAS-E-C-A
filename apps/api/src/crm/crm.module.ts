import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ActivitiesController, CompaniesController, ContactsController, DealsController, PipelineStagesController, TagsController } from './crm.controller';
import { CrmService } from './crm.service';

@Module({
  imports: [AuthModule],
  controllers: [ContactsController, CompaniesController, DealsController, ActivitiesController, PipelineStagesController, TagsController],
  providers: [CrmService],
})
export class CrmModule {}
