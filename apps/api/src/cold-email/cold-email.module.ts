import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProvidersModule } from '../providers/providers.module';
import {
  SendingDomainsController,
  ColdMailboxController,
  ColdProspectListController,
  ColdCampaignController,
  ColdSendEngineController,
  ColdEmailWebhookController,
} from './cold-email.controller';
import { ColdEmailService } from './cold-email.service';

@Module({
  imports: [AuthModule, ProvidersModule],
  controllers: [
    SendingDomainsController,
    ColdMailboxController,
    ColdProspectListController,
    ColdCampaignController,
    ColdSendEngineController,
    ColdEmailWebhookController,
  ],
  providers: [ColdEmailService],
})
export class ColdEmailModule {}
