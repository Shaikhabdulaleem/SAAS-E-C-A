import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types';
import { AdminFeatureFlagsService } from './admin-feature-flags.service';

@Controller('admin/feature-flags')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class AdminFeatureFlagsController {
  constructor(private readonly flags: AdminFeatureFlagsService) {}

  @Get()
  list() { return this.flags.listFlags(); }

  @Post()
  create(@Body() body: { key: string; name: string; description?: string; isGlobal?: boolean; defaultOn?: boolean }) {
    return this.flags.createFlag(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { name?: string; description?: string; isGlobal?: boolean; defaultOn?: boolean }) {
    return this.flags.updateFlag(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.flags.removeFlag(id); }

  @Get('tenant/:tenantId')
  tenantFlags(@Param('tenantId') tenantId: string) { return this.flags.getTenantFlags(tenantId); }

  @Put('tenant/:tenantId/:flagId')
  toggle(
    @Param('tenantId') tenantId: string,
    @Param('flagId') flagId: string,
    @Body() body: { enabled: boolean },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.flags.toggleTenantFlag(tenantId, flagId, body.enabled, user.id);
  }
}
