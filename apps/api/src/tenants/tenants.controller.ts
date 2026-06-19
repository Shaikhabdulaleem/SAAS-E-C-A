import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
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
  list() {
    return this.tenants.list();
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
