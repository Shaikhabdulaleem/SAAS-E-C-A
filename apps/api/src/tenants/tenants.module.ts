import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { EncryptionService } from './encryption.service';

@Module({
  imports: [AuthModule],
  controllers: [TenantsController],
  providers: [TenantsService, EncryptionService],
})
export class TenantsModule {}
