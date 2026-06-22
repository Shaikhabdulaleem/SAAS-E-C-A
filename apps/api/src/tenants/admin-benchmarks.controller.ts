import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminBenchmarksService } from './admin-benchmarks.service';

@Controller('admin/benchmarks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class AdminBenchmarksController {
  constructor(private readonly benchmarks: AdminBenchmarksService) {}

  @Get()
  get() { return this.benchmarks.getBenchmarks(); }

  @Get('compare')
  compare(@Query('ids') ids: string) {
    const idArray = ids ? ids.split(',').filter(Boolean) : [];
    return this.benchmarks.compareTenants(idArray);
  }
}
