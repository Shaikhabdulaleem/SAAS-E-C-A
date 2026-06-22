import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminDomainPurchasesService } from './admin-domain-purchases.service';

@Controller('admin/domain-purchases')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class AdminDomainPurchasesController {
  constructor(private readonly domainPurchases: AdminDomainPurchasesService) {}

  @Get()
  overview(@Query() query: Record<string, string>) {
    return this.domainPurchases.getOverview(query);
  }
}
