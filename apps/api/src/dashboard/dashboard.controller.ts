import { Controller, Get, Headers, UseGuards } from '@nestjs/common';
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
  overview(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.dashboard.overview(tenantId(user, selectedTenantId, adminImpersonation));
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.dashboard.summary(tenantId(user, selectedTenantId, adminImpersonation));
  }

  @Get('pipeline')
  pipeline(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.dashboard.pipeline(tenantId(user, selectedTenantId, adminImpersonation));
  }

  @Get('campaign-performance')
  campaignPerformance(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.dashboard.campaignPerformance(tenantId(user, selectedTenantId, adminImpersonation));
  }

  @Get('weekly-activity')
  weeklyActivity(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.dashboard.weeklyActivity(tenantId(user, selectedTenantId, adminImpersonation));
  }

  @Get('contact-status')
  contactStatus(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.dashboard.contactStatus(tenantId(user, selectedTenantId, adminImpersonation));
  }

  @Get('recent-activities')
  recentActivities(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.dashboard.recentActivities(tenantId(user, selectedTenantId, adminImpersonation));
  }
}
