import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types';
import { AdminTenantExtrasService } from './admin-tenant-extras.service';

@Controller('admin/tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class AdminTenantExtrasController {
  constructor(private readonly extras: AdminTenantExtrasService) {}

  @Get(':tenantId/health')
  getHealth(@Param('tenantId') tenantId: string) {
    return this.extras.getHealth(tenantId);
  }

  @Get(':tenantId/usage')
  getUsage(@Param('tenantId') tenantId: string) {
    return this.extras.getUsage(tenantId);
  }

  @Get(':tenantId/onboarding')
  getOnboarding(@Param('tenantId') tenantId: string) {
    return this.extras.getOnboarding(tenantId);
  }

  @Get(':tenantId/members')
  getMembers(@Param('tenantId') tenantId: string) {
    return this.extras.getMembers(tenantId);
  }

  @Patch(':tenantId/members/:userId')
  updateMemberRole(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Body() body: { role: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.extras.updateMemberRole(tenantId, userId, body.role, user.id);
  }

  @Delete(':tenantId/members/:userId')
  removeMember(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.extras.removeMember(tenantId, userId, user.id);
  }

  @Get(':tenantId/billing')
  getBilling(@Param('tenantId') tenantId: string) {
    return this.extras.getBilling(tenantId);
  }

  @Post(':tenantId/notify')
  notify(
    @Param('tenantId') tenantId: string,
    @Body() body: { title: string; body: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.extras.notifyTenant(tenantId, body.title, body.body, user.id);
  }

  @Post(':tenantId/export')
  exportData(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.extras.exportTenantData(tenantId, user.id);
  }

  @Post(':tenantId/gdpr-delete')
  gdprDelete(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.extras.gdprDelete(tenantId, user.id);
  }
}
