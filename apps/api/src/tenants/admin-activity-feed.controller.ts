import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminActivityFeedService } from './admin-activity-feed.service';

@Controller('admin/activity-feed')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class AdminActivityFeedController {
  constructor(private readonly activityFeed: AdminActivityFeedService) {}

  @Get()
  feed(@Query() query: Record<string, string>) {
    return this.activityFeed.getFeed(query);
  }
}
