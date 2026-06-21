import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProvidersModule } from '../providers/providers.module';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';

@Module({
  imports: [PrismaModule, ProvidersModule, AuthModule],
  controllers: [CallsController],
  providers: [CallsService],
})
export class CallsModule {}
