import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminAlertsService } from './admin-alerts.service';

@Controller('admin/alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class AdminAlertsController {
  constructor(private readonly alerts: AdminAlertsService) {}

  @Get('rules')
  listRules() { return this.alerts.listRules(); }

  @Post('rules')
  createRule(@Body() body: { name: string; description?: string; metric: string; operator: string; threshold: number; severity?: string; notifyAdmin?: boolean }) {
    return this.alerts.createRule(body);
  }

  @Patch('rules/:id')
  updateRule(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.alerts.updateRule(id, body);
  }

  @Delete('rules/:id')
  removeRule(@Param('id') id: string) { return this.alerts.removeRule(id); }

  @Get('evaluate')
  evaluate() { return this.alerts.evaluate(); }

  @Get('events')
  listEvents(@Query() query: Record<string, string>) { return this.alerts.listEvents(query); }

  @Patch('events/:id/resolve')
  resolveEvent(@Param('id') id: string) { return this.alerts.resolveEvent(id); }
}
