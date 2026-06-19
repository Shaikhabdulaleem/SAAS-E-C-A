import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EncryptionService } from '../tenants/encryption.service';
import { DnsProviderService } from './services/dns-provider.service';
import { EmailDeliveryService } from './services/email-delivery.service';
import { JobsService } from './services/jobs.service';
import { MailboxProvisioningService } from './services/mailbox-provisioning.service';
import { ProviderLogsService } from './services/provider-logs.service';
import { TranscriptionService } from './services/transcription.service';

@Module({
  imports: [PrismaModule],
  providers: [
    EncryptionService,
    JobsService,
    ProviderLogsService,
    EmailDeliveryService,
    DnsProviderService,
    MailboxProvisioningService,
    TranscriptionService,
  ],
  exports: [
    JobsService,
    ProviderLogsService,
    EmailDeliveryService,
    DnsProviderService,
    MailboxProvisioningService,
    TranscriptionService,
  ],
})
export class ProvidersModule {}
