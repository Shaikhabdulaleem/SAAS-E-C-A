import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProvidersModule } from '../providers/providers.module';
import { BrandingService } from '../proposals/branding.service';
import { AdminFinanceController, FinanceController, PublicFinanceInvoiceController } from './finance.controller';
import { FinanceActivityService } from './finance-activity.service';
import { FinanceEmailService } from './finance-email.service';
import { FinanceNumberService } from './finance-number.service';
import { FinancePdfService } from './finance-pdf.service';
import { FinanceService } from './finance.service';

@Module({
  imports: [AuthModule, ProvidersModule],
  controllers: [FinanceController, AdminFinanceController, PublicFinanceInvoiceController],
  providers: [
    FinanceService,
    FinanceNumberService,
    FinanceActivityService,
    FinancePdfService,
    FinanceEmailService,
    BrandingService,
  ],
})
export class FinanceModule {}
