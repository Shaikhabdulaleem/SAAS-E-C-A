import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminCallAnalyticsService } from './admin-call-analytics.service';

@Controller('admin/calls')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class AdminCallAnalyticsController {
  constructor(private readonly callAnalytics: AdminCallAnalyticsService) {}

  @Get('summary')
  summary() {
    return this.callAnalytics.getSummary();
  }
}
