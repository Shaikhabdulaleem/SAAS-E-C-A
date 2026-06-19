import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireService } from '../auth/decorators/required-service.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ServiceAccessGuard } from '../auth/guards/service-access.guard';
import { AuthenticatedUser } from '../auth/types';
import { EmailService } from './email.service';

function tenantId(user: AuthenticatedUser, selectedTenantId?: string) {
  if (user.tenantId) return user.tenantId;
  if (user.role === UserRole.superadmin && selectedTenantId) return selectedTenantId;
  throw new BadRequestException('Tenant context is required');
}

@Controller('email/campaigns')
@RequireService('email_marketing')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class EmailController {
  constructor(private readonly email: EmailService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.listCampaigns(tenantId(user, selectedTenantId), query);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.createCampaign(tenantId(user, selectedTenantId), user.id, body);
  }

  @Get(':campaignId')
  get(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.getCampaign(tenantId(user, selectedTenantId), campaignId);
  }

  @Patch(':campaignId')
  update(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.updateCampaign(tenantId(user, selectedTenantId), campaignId, body);
  }

  @Post(':campaignId/schedule')
  schedule(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.scheduleCampaign(tenantId(user, selectedTenantId), campaignId, body);
  }

  @Post(':campaignId/send-now')
  sendNow(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.sendCampaignNow(tenantId(user, selectedTenantId), campaignId);
  }

  @Post(':campaignId/send-test')
  sendTest(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.sendTest(tenantId(user, selectedTenantId), campaignId, body);
  }

  @Delete(':campaignId')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.deleteCampaign(tenantId(user, selectedTenantId), campaignId);
  }
}

@Controller('email/templates')
@RequireService('email_marketing')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class TemplatesController {
  constructor(private readonly email: EmailService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.listTemplates(tenantId(user, selectedTenantId));
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.createTemplate(tenantId(user, selectedTenantId), user.id, body);
  }

  @Patch(':templateId')
  update(@CurrentUser() user: AuthenticatedUser, @Param('templateId') templateId: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.updateTemplate(tenantId(user, selectedTenantId), templateId, body);
  }

  @Delete(':templateId')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('templateId') templateId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.deleteTemplate(tenantId(user, selectedTenantId), templateId);
  }
}

@Controller('email/suppressions')
@RequireService('email_marketing')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class SuppressionsController {
  constructor(private readonly email: EmailService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.listSuppressions(tenantId(user, selectedTenantId));
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.addSuppression(tenantId(user, selectedTenantId), body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.removeSuppression(tenantId(user, selectedTenantId), id);
  }
}

@Controller('email/events')
export class EmailEventsController {
  constructor(private readonly email: EmailService) {}

  @Get('open/:token')
  open(@Param('token') token: string, @Req() req: { headers?: Record<string, string>; ip?: string }) {
    return this.email.trackEvent('open', token, { userAgent: req.headers?.['user-agent'], ipAddress: req.ip });
  }

  @Get('click/:token')
  click(@Param('token') token: string, @Query('url') url: string, @Req() req: { headers?: Record<string, string>; ip?: string }) {
    return this.email.trackEvent('click', token, { userAgent: req.headers?.['user-agent'], ipAddress: req.ip, url });
  }

  @Get('unsubscribe/:token')
  unsubscribe(@Param('token') token: string) {
    return this.email.handleUnsubscribe(token);
  }
}

@Controller('webhooks/email')
export class EmailWebhookController {
  constructor(private readonly email: EmailService) {}

  @Post('sendgrid')
  sendgrid(@Body() body: unknown) {
    return this.email.handleProviderEvents(body);
  }
}
