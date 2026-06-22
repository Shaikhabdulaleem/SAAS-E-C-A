import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminColdEmailService } from './admin-cold-email.service';

@Controller('admin/cold-email')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class AdminColdEmailController {
  constructor(private readonly coldEmail: AdminColdEmailService) {}

  @Get('health')
  health() {
    return this.coldEmail.getHealth();
  }

  @Get('replies-summary')
  repliesSummary() {
    return this.coldEmail.getRepliesSummary();
  }
}
