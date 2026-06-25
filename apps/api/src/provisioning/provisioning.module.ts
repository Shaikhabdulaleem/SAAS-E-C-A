import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProvidersModule } from '../providers/providers.module';
import { EncryptionService } from '../tenants/encryption.service';
import { GoogleOAuthCallbackController } from './google-oauth-callback.controller';
import { ProvisioningController } from './provisioning.controller';
import { ProvisioningService } from './provisioning.service';

@Module({
  imports: [AuthModule, ProvidersModule],
  controllers: [ProvisioningController, GoogleOAuthCallbackController],
  providers: [ProvisioningService, EncryptionService],
})
export class ProvisioningModule {}
