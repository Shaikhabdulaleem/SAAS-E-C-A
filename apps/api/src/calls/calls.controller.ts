import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireService } from '../auth/decorators/required-service.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ServiceAccessGuard } from '../auth/guards/service-access.guard';
import { AuthenticatedUser } from '../auth/types';
import { resolveTenantId } from '../common/tenant-context';
import { CallsService } from './calls.service';

@Controller('calls')
@RequireService('ai_assistant')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Get('sessions')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.calls.list(resolveTenantId(user, selectedTenantId), query);
  }

  @Post('sessions')
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.calls.createSession(resolveTenantId(user, selectedTenantId), user.id, body);
  }

  @Get('sessions/:id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.calls.get(resolveTenantId(user, selectedTenantId), id);
  }

  @Post('sessions/:id/recordings')
  addRecording(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.calls.addRecording(resolveTenantId(user, selectedTenantId), id, body);
  }

  @Post('sessions/:id/transcripts')
  addTranscript(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.calls.addTranscript(resolveTenantId(user, selectedTenantId), id, body);
  }

  @Post('sessions/:id/summarize')
  summarize(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.calls.summarize(resolveTenantId(user, selectedTenantId), user.id, id);
  }

  @Get('sessions/:id/insights')
  insights(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.calls.insights(resolveTenantId(user, selectedTenantId), id);
  }
}
