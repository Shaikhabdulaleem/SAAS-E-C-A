import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types';
import { AdminNpsService } from './admin-nps.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class AdminNpsController {
  constructor(private readonly nps: AdminNpsService) {}

  @Post('tenants/:tenantId/nps')
  record(@Param('tenantId') tenantId: string, @Body() body: { score: number; feedback?: string; userId?: string }, @CurrentUser() user: AuthenticatedUser) {
    return this.nps.recordScore(tenantId, body, user.id);
  }

  @Get('nps/summary')
  summary() { return this.nps.getSummary(); }

  @Get('tenants/:tenantId/nps')
  tenantNps(@Param('tenantId') tenantId: string) { return this.nps.getTenantNps(tenantId); }
}
