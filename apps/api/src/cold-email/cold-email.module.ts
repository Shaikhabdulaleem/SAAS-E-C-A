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
  EmailFinderController,
} from './cold-email.controller';
import { ColdEmailService } from './cold-email.service';
import { EncryptionService } from '../tenants/encryption.service';

@Module({
  imports: [AuthModule, ProvidersModule],
  controllers: [
    SendingDomainsController,
    ColdMailboxController,
    ColdProspectListController,
    ColdCampaignController,
    ColdSendEngineController,
    ColdEmailWebhookController,
    EmailFinderController,
  ],
  providers: [ColdEmailService, EncryptionService],
})
export class ColdEmailModule {}
