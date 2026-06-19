import { BadRequestException, Controller, Get, Headers, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { DashboardService } from './dashboard.service';

function tenantId(user: AuthenticatedUser, selectedTenantId?: string) {
  if (user.tenantId) return user.tenantId;
  if (user.role === UserRole.superadmin && selectedTenantId) return selectedTenantId;
  throw new BadRequestException('Tenant context is required');
}

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.dashboard.overview(tenantId(user, selectedTenantId));
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.dashboard.summary(tenantId(user, selectedTenantId));
  }

  @Get('pipeline')
  pipeline(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.dashboard.pipeline(tenantId(user, selectedTenantId));
  }

  @Get('campaign-performance')
  campaignPerformance(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.dashboard.campaignPerformance(tenantId(user, selectedTenantId));
  }

  @Get('weekly-activity')
  weeklyActivity(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.dashboard.weeklyActivity(tenantId(user, selectedTenantId));
  }

  @Get('contact-status')
  contactStatus(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.dashboard.contactStatus(tenantId(user, selectedTenantId));
  }

  @Get('recent-activities')
  recentActivities(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.dashboard.recentActivities(tenantId(user, selectedTenantId));
  }
}
