import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types';
import { TenantsService } from './tenants.service';

@Controller('admin/tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  list(@Query() query: Record<string, string>) {
    return this.tenants.list(query);
  }

  @Post('bulk-action')
  bulkAction(
    @Body() body: { ids: string[]; action: string; params?: Record<string, unknown> },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tenants.bulkAction(body.ids, body.action, body.params ?? {}, user.id);
  }

  @Post()
  create(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.tenants.create(body, user.id);
  }

  @Get(':tenantId')
  get(@Param('tenantId') tenantId: string) {
    return this.tenants.get(tenantId);
  }

  @Patch(':tenantId')
  update(
    @Param('tenantId') tenantId: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tenants.update(tenantId, body, user.id);
  }

  @Delete(':tenantId')
  remove(@Param('tenantId') tenantId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tenants.remove(tenantId, user.id);
  }

  @Delete(':tenantId/hard')
  hardRemove(@Param('tenantId') tenantId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tenants.remove(tenantId, user.id, true);
  }

  @Get(':tenantId/export')
  exportData(@Param('tenantId') tenantId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tenants.exportTenantData(tenantId, user.id);
  }

  @Get(':tenantId/access')
  access(@Param('tenantId') tenantId: string) {
    return this.tenants.getAccess(tenantId);
  }

  @Post(':tenantId/access/invite-owner')
  inviteOwner(@Param('tenantId') tenantId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tenants.inviteOwner(tenantId, user.id);
  }

  @Post(':tenantId/access/create-owner-login')
  createOwnerLogin(@Param('tenantId') tenantId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tenants.createOwnerLogin(tenantId, user.id);
  }

  @Post(':tenantId/access/reset-owner-password')
  resetOwnerPassword(@Param('tenantId') tenantId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tenants.resetOwnerPassword(tenantId, user.id);
  }

  @Get(':tenantId/access/login-details')
  loginDetails(@Param('tenantId') tenantId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tenants.loginDetails(tenantId, user.id);
  }

  @Post(':tenantId/integrations')
  addIntegration(
    @Param('tenantId') tenantId: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tenants.addIntegration(tenantId, body, user.id);
  }

  @Patch(':tenantId/integrations/:integrationId')
  updateIntegration(
    @Param('tenantId') tenantId: string,
    @Param('integrationId') integrationId: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tenants.updateIntegration(tenantId, integrationId, body, user.id);
  }

  @Delete(':tenantId/integrations/:integrationId')
  removeIntegration(
    @Param('tenantId') tenantId: string,
    @Param('integrationId') integrationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tenants.removeIntegration(tenantId, integrationId, user.id);
  }
}
