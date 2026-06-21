import { Body, Controller, Get, Headers, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ServiceAccessGuard } from '../auth/guards/service-access.guard';
import { RequireService } from '../auth/decorators/required-service.decorator';
import { AuthenticatedUser } from '../auth/types';
import { resolveTenantId } from '../common/tenant-context';
import { ClientSettingsService } from './client-settings.service';
import { ProposalsService } from './proposals.service';

@Controller('client')
@RequireService('proposals')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class ClientSettingsController {
  constructor(
    private readonly settings: ClientSettingsService,
    private readonly proposals: ProposalsService,
  ) {}

  @Get('brand-settings')
  getBrand(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.settings.getBrandSettings(resolveTenantId(user, selectedTenantId, adminImpersonation));
  }

  @Put('brand-settings')
  updateBrand(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.settings.updateBrandSettings(resolveTenantId(user, selectedTenantId, adminImpersonation), body);
  }

  @Get('service-pricing')
  getPricing(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.settings.getServicePricing(resolveTenantId(user, selectedTenantId, adminImpersonation));
  }

  @Put('service-pricing')
  updatePricing(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.settings.updateServicePricing(resolveTenantId(user, selectedTenantId, adminImpersonation), body);
  }

  @Get('proposals/profit-summary')
  profitSummary(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.proposals.getProfitSummary(resolveTenantId(user, selectedTenantId, adminImpersonation));
  }
}
