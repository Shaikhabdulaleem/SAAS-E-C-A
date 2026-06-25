import { Controller, Get, Headers, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { resolveTenantId } from '../common/tenant-context';
import { DashboardService } from './dashboard.service';

function tenantId(user: AuthenticatedUser, selectedTenantId?: string, adminImpersonation?: string) {
  return resolveTenantId(user, selectedTenantId, adminImpersonation);
}

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.dashboard.overview(tenantId(user, selectedTenantId, adminImpersonation), query);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.dashboard.summary(tenantId(user, selectedTenantId, adminImpersonation), query);
  }

  @Get('pipeline')
  pipeline(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.dashboard.pipeline(tenantId(user, selectedTenantId, adminImpersonation), query);
  }

  @Get('campaign-performance')
  campaignPerformance(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.dashboard.campaignPerformance(tenantId(user, selectedTenantId, adminImpersonation), query);
  }

  @Get('weekly-activity')
  weeklyActivity(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.dashboard.weeklyActivity(tenantId(user, selectedTenantId, adminImpersonation), query);
  }

  @Get('contact-status')
  contactStatus(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.dashboard.contactStatus(tenantId(user, selectedTenantId, adminImpersonation));
  }

  @Get('recent-activities')
  recentActivities(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.dashboard.recentActivities(tenantId(user, selectedTenantId, adminImpersonation));
  }

  @Get('export.csv')
  async exportCsv(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>, @Res() response: Response, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    const csv = await this.dashboard.exportCsv(tenantId(user, selectedTenantId, adminImpersonation), query);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="dashboard.csv"');
    return response.send(csv);
  }
}
