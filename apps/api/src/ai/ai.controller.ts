import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireService } from '../auth/decorators/required-service.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ServiceAccessGuard } from '../auth/guards/service-access.guard';
import { AuthenticatedUser } from '../auth/types';
import { AiService } from './ai.service';

function tenantId(user: AuthenticatedUser, selectedTenantId?: string) {
  if (user.tenantId) return user.tenantId;
  if (user.role === UserRole.superadmin && selectedTenantId) return selectedTenantId;
  throw new BadRequestException('Tenant context is required');
}

@Controller('ai')
@RequireService('ai_assistant')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('sessions')
  sessions(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.ai.listSessions(tenantId(user, selectedTenantId), user.id);
  }

  @Post('sessions')
  createSession(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.ai.createSession(tenantId(user, selectedTenantId), user.id, body);
  }

  @Get('sessions/:sessionId/messages')
  messages(@CurrentUser() user: AuthenticatedUser, @Param('sessionId') sessionId: string, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.ai.listMessages(tenantId(user, selectedTenantId), user.id, sessionId, query);
  }

  @Post('chat')
  chat(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.ai.chat(tenantId(user, selectedTenantId), user.id, body);
  }

  @Post('generate-email')
  generateEmail(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.ai.generateEmail(tenantId(user, selectedTenantId), user.id, body);
  }

  @Get('daily-summary')
  dailySummary(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.ai.dailySummary(tenantId(user, selectedTenantId), user.id);
  }

  @Get('usage')
  usage(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.ai.usage(tenantId(user, selectedTenantId), user.id, query);
  }
}
