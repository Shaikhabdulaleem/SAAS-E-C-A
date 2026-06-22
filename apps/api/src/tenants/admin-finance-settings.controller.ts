import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminFinanceSettingsService } from './admin-finance-settings.service';

@Controller('admin/finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class AdminFinanceSettingsController {
  constructor(private readonly financeSettings: AdminFinanceSettingsService) {}

  @Get('tax-defaults')
  getTaxDefaults() { return this.financeSettings.getTaxDefaults(); }

  @Put('tax-defaults')
  upsertTaxDefault(@Body() body: { id?: string; name: string; rate: number; type?: string; appliesTo?: string; region?: string; isDefault?: boolean; isActive?: boolean }) {
    return this.financeSettings.upsertTaxDefault(body);
  }

  @Get('settings')
  getSettings() { return this.financeSettings.getFinanceSettings(); }

  @Put('settings')
  updateSettings(@Body() body: Record<string, unknown>) { return this.financeSettings.updateFinanceSettings(body); }
}
