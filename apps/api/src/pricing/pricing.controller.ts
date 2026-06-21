import { Body, Controller, Get, Param, Patch, Put, UseGuards } from '@nestjs/common';
import { PlanKey, UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PricingService } from './pricing.service';

@Controller('admin/pricing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get()
  catalog() {
    return this.pricing.catalog();
  }

  @Put('services/:key')
  upsertService(@Param('key') key: string, @Body() body: Record<string, unknown>) {
    return this.pricing.upsertService(key, body);
  }

  @Patch('plans/:key')
  updatePlan(@Param('key') key: PlanKey, @Body() body: Record<string, unknown>) {
    return this.pricing.updatePlan(key, body);
  }
}
