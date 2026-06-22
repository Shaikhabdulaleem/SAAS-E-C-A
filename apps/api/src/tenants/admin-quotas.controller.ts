import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types';
import { AdminQuotasService } from './admin-quotas.service';

@Controller('admin/tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class AdminQuotasController {
  constructor(private readonly quotas: AdminQuotasService) {}

  @Get(':tenantId/quotas')
  getQuotas(@Param('tenantId') tenantId: string) {
    return this.quotas.getQuotas(tenantId);
  }

  @Put(':tenantId/quotas')
  upsertQuotas(
    @Param('tenantId') tenantId: string,
    @Body() body: Array<{ resource: string; limitValue: number; warnAt?: number }>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quotas.upsertQuotas(tenantId, body, user.id);
  }
}
