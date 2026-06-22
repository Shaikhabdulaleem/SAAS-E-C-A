import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminAiUsageService } from './admin-ai-usage.service';

@Controller('admin/ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class AdminAiUsageController {
  constructor(private readonly aiUsage: AdminAiUsageService) {}

  @Get('usage-summary')
  usageSummary() {
    return this.aiUsage.getUsageSummary();
  }
}
