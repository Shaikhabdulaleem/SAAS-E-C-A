import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { resolveTenantId } from '../common/tenant-context';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.notifications.list(resolveTenantId(user, selectedTenantId), user.id, query);
  }

  @Patch(':id/read')
  read(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.notifications.markRead(resolveTenantId(user, selectedTenantId), user.id, id);
  }

  @Post('mark-all-read')
  markAll(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.notifications.markAllRead(resolveTenantId(user, selectedTenantId), user.id);
  }

  @Get('preferences')
  preferences(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.notifications.preferences(resolveTenantId(user, selectedTenantId), user.id);
  }

  @Patch('preferences')
  updatePreferences(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.notifications.updatePreferences(resolveTenantId(user, selectedTenantId), user.id, body);
  }
}
