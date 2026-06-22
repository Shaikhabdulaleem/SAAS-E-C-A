import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types';
import { AdminNotificationsService } from './admin-notifications.service';

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class AdminNotificationsController {
  constructor(private readonly notifications: AdminNotificationsService) {}

  @Post('broadcast')
  broadcast(
    @Body() body: { title: string; body: string; statusFilter?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notifications.broadcast(body.title, body.body, body.statusFilter, user.id);
  }

  @Get('sent')
  sent(@Query() query: Record<string, string>) {
    const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 100);
    return this.notifications.listSent(limit);
  }
}
