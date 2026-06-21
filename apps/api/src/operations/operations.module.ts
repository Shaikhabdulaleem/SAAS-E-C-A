import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProvidersModule } from '../providers/providers.module';
import { AuditLogController } from './audit.controller';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

@Module({
  imports: [PrismaModule, ProvidersModule, AuthModule],
  controllers: [OperationsController, AuditLogController],
  providers: [OperationsService],
})
export class OperationsModule {}
