import { BadRequestException, Body, Controller, Delete, Get, Headers, Post, Put, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ServiceAccessGuard } from '../auth/guards/service-access.guard';
import { RequireService } from '../auth/decorators/required-service.decorator';
import { AuthenticatedUser } from '../auth/types';
import { resolveTenantId } from '../common/tenant-context';
import { imageUploadOptions, saveUploadedFile, deleteUploadedFile } from '../common/file-upload.util';
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

  @Post('brand-settings/logo')
  @UseInterceptors(FileInterceptor('logo', imageUploadOptions()))
  async uploadLogo(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    if (!file) throw new BadRequestException('Logo file is required');
    const tid = resolveTenantId(user, selectedTenantId, adminImpersonation);
    const existing = await this.settings.getBrandSettings(tid);
    const logoUrl = await saveUploadedFile(file, 'logos');
    if (existing?.logoUrl) deleteUploadedFile(existing.logoUrl);
    return this.settings.updateBrandSettings(tid, { logoUrl });
  }

  @Delete('brand-settings/logo')
  async removeLogo(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    const tid = resolveTenantId(user, selectedTenantId, adminImpersonation);
    const existing = await this.settings.getBrandSettings(tid);
    if (existing?.logoUrl) deleteUploadedFile(existing.logoUrl);
    return this.settings.updateBrandSettings(tid, { logoUrl: null });
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
