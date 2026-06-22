import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types';
import { AdminContractsService } from './admin-contracts.service';

@Controller('admin/contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class AdminContractsController {
  constructor(private readonly contracts: AdminContractsService) {}

  @Get()
  list(@Query() query: Record<string, string>) { return this.contracts.list(query); }

  @Post()
  create(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.contracts.create(body, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.contracts.update(id, body, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.contracts.remove(id, user.id);
  }

  @Get('expiring')
  expiring() { return this.contracts.getExpiring(); }

  @Get('tenant/:tenantId')
  tenantContracts(@Param('tenantId') tenantId: string) {
    return this.contracts.getTenantContracts(tenantId);
  }
}
