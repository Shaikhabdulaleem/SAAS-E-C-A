import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProvidersModule } from '../providers/providers.module';
import { CrmModule } from '../crm/crm.module';
import { AdminProposalsController, ProposalsController } from './proposals.controller';
import { ProposalPublicController } from './proposal-public.controller';
import { ClientSettingsController } from './client-settings.controller';
import { ProposalsService } from './proposals.service';
import { ProposalNumberService } from './proposal-number.service';
import { BrandingService } from './branding.service';
import { ProposalActivityService } from './proposal-activity.service';
import { ProposalPdfService } from './proposal-pdf.service';
import { ProposalEmailService } from './proposal-email.service';
import { ClientSettingsService } from './client-settings.service';
import { ProposalTemplateService } from './proposal-template.service';

@Module({
  imports: [AuthModule, ProvidersModule, CrmModule],
  controllers: [
    ProposalsController,
    AdminProposalsController,
    ProposalPublicController,
    ClientSettingsController,
  ],
  providers: [
    ProposalsService,
    ProposalNumberService,
    BrandingService,
    ProposalActivityService,
    ProposalPdfService,
    ProposalEmailService,
    ClientSettingsService,
    ProposalTemplateService,
  ],
})
export class ProposalsModule {}
