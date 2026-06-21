import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { ServiceAccessGuard } from './guards/service-access.guard';
import { TenantRolesGuard } from './guards/tenant-roles.guard';
import { EncryptionService } from '../tenants/encryption.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, ServiceAccessGuard, TenantRolesGuard, EncryptionService],
  exports: [AuthService, PasswordService, TokenService, ServiceAccessGuard, TenantRolesGuard],
})
export class AuthModule {}
