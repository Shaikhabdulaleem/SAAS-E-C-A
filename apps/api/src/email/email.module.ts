import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProvidersModule } from '../providers/providers.module';
import { EmailController, EmailEventsController, EmailWebhookController, SuppressionsController, TemplatesController } from './email.controller';
import { EmailService } from './email.service';

@Module({
  imports: [AuthModule, ProvidersModule],
  controllers: [EmailController, TemplatesController, SuppressionsController, EmailEventsController, EmailWebhookController],
  providers: [EmailService],
})
export class EmailModule {}
