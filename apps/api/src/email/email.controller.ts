import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
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

  @Get('aggregate-analytics')
  aggregateAnalytics(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.aggregateAnalytics(tenantId(user, selectedTenantId));
  }

  @Post('compare')
  compare(@CurrentUser() user: AuthenticatedUser, @Body() body: { ids: string[] }, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.compareCampaigns(tenantId(user, selectedTenantId), body.ids);
  }

  @Get('audience-csv-template')
  audienceTemplate() {
    return this.email.audienceCsvTemplate();
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.createCampaign(tenantId(user, selectedTenantId), user.id, body);
  }

  @Post('preflight')
  preflight(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.preflightCampaign(tenantId(user, selectedTenantId), body);
  }

  @Post('create-and-schedule')
  createAndSchedule(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.createAndScheduleCampaign(tenantId(user, selectedTenantId), user.id, body);
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

  @Post(':campaignId/audience-preview')
  audiencePreview(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.previewAudience(tenantId(user, selectedTenantId), campaignId, body);
  }

  @Get(':campaignId/readiness')
  readiness(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.readiness(tenantId(user, selectedTenantId), campaignId);
  }

  @Post(':campaignId/send-now')
  sendNow(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.sendCampaignNow(tenantId(user, selectedTenantId), campaignId);
  }

  @Post(':campaignId/follow-up')
  followUp(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.createFollowUpCampaign(tenantId(user, selectedTenantId), user.id, campaignId, body);
  }

  @Post(':campaignId/cancel')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.cancelCampaign(tenantId(user, selectedTenantId), campaignId);
  }

  @Post(':campaignId/send-test')
  sendTest(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.sendTest(tenantId(user, selectedTenantId), campaignId, body);
  }

  @Get(':campaignId/recipients')
  recipients(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.listRecipients(tenantId(user, selectedTenantId), campaignId, {
      page: query.page ? parseInt(query.page, 10) : undefined,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : undefined,
      status: query.status || undefined,
      search: query.search || undefined,
    });
  }

  @Get(':campaignId/events')
  events(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.listEvents(tenantId(user, selectedTenantId), campaignId);
  }

  @Get(':campaignId/analytics')
  analytics(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.analytics(tenantId(user, selectedTenantId), campaignId);
  }

  @Post(':campaignId/toggle-star')
  toggleStar(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.toggleStar(tenantId(user, selectedTenantId), campaignId);
  }

  @Get(':campaignId/recipients/:recipientId/timeline')
  recipientTimeline(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Param('recipientId') recipientId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.recipientTimeline(tenantId(user, selectedTenantId), campaignId, recipientId);
  }

  @Get(':campaignId/preview')
  preview(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.previewCampaign(tenantId(user, selectedTenantId), campaignId);
  }

  @Get(':campaignId/export-csv')
  async exportCsv(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.exportRecipientsCsv(tenantId(user, selectedTenantId), campaignId);
  }

  @Get(':campaignId/view')
  async viewInBrowser(@Param('campaignId') campaignId: string, @Req() req: any, @Headers('x-tenant-id') selectedTenantId?: string) {
    const tid = selectedTenantId ?? req.query?.tenantId;
    if (!tid) return '<p>Missing tenant context</p>';
    return this.email.viewInBrowser(tid, campaignId);
  }

  @Get(':campaignId/ab-results')
  abResults(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.abTestResults(tenantId(user, selectedTenantId), campaignId);
  }

  @Get(':campaignId/link-analytics')
  linkAnalytics(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.linkAnalytics(tenantId(user, selectedTenantId), campaignId);
  }

  @Post(':campaignId/pause')
  pause(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.pauseCampaign(tenantId(user, selectedTenantId), campaignId);
  }

  @Post(':campaignId/resume')
  resume(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.resumeCampaign(tenantId(user, selectedTenantId), campaignId);
  }

  @Get(':campaignId/status')
  status(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.campaignStatus(tenantId(user, selectedTenantId), campaignId);
  }

  @Post('bulk-delete')
  bulkDelete(@CurrentUser() user: AuthenticatedUser, @Body() body: { ids: string[] }, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.bulkDeleteCampaigns(tenantId(user, selectedTenantId), body.ids);
  }

  @Delete(':campaignId')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.deleteCampaign(tenantId(user, selectedTenantId), campaignId);
  }
}

@Controller('email/domains')
@RequireService('email_marketing')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class EmailDomainsController {
  constructor(private readonly email: EmailService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.listDomains(tenantId(user, selectedTenantId));
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.addDomain(tenantId(user, selectedTenantId), body);
  }

  @Patch(':domainId/dns-records')
  updateDns(@CurrentUser() user: AuthenticatedUser, @Param('domainId') domainId: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.updateDomainDnsRecords(tenantId(user, selectedTenantId), domainId, body);
  }

  @Post(':domainId/verify')
  verify(@CurrentUser() user: AuthenticatedUser, @Param('domainId') domainId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.verifyDomain(tenantId(user, selectedTenantId), domainId);
  }

  @Get('limits')
  limits(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.getDomainLimits(tenantId(user, selectedTenantId));
  }

  @Patch(':domainId/limit')
  updateLimit(@CurrentUser() user: AuthenticatedUser, @Param('domainId') domainId: string, @Body() body: { dailyCap: number }, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.updateDomainLimit(tenantId(user, selectedTenantId), domainId, body.dailyCap);
  }

  @Delete(':domainId')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('domainId') domainId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.removeDomain(tenantId(user, selectedTenantId), domainId);
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

  @Get(':templateId/versions')
  versions(@CurrentUser() user: AuthenticatedUser, @Param('templateId') templateId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.getTemplateVersions(tenantId(user, selectedTenantId), templateId);
  }

  @Post(':templateId/restore/:versionId')
  restore(@CurrentUser() user: AuthenticatedUser, @Param('templateId') templateId: string, @Param('versionId') versionId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.restoreTemplateVersion(tenantId(user, selectedTenantId), templateId, versionId);
  }

  @Post('render-mjml')
  renderMjml(@Body() body: { mjml: string }) {
    return this.email.renderMjml(body.mjml);
  }

  @Get('blocks/list')
  listBlocks(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.listContentBlocks(tenantId(user, selectedTenantId));
  }

  @Post('blocks')
  saveBlock(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.saveContentBlock(tenantId(user, selectedTenantId), user.id, body);
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

  @Post('bulk-import')
  bulkImport(@CurrentUser() user: AuthenticatedUser, @Body() body: { entries: Array<{ email: string; source?: string; reason?: string }> }, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.bulkImportSuppressions(tenantId(user, selectedTenantId), body.entries);
  }

  @Get('export')
  exportCsv(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.exportSuppressions(tenantId(user, selectedTenantId));
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
  async open(@Param('token') token: string, @Req() req: { headers?: Record<string, string>; ip?: string }, @Res() res: { setHeader: (name: string, value: string) => void; end: (body?: Buffer) => void }) {
    await this.email.trackEvent('open', token, { userAgent: req.headers?.['user-agent'], ipAddress: req.ip });
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store');
    res.end(Buffer.from('R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64'));
  }

  @Get('click/:token')
  async click(@Param('token') token: string, @Query('url') url: string, @Req() req: { headers?: Record<string, string>; ip?: string }, @Res() res: { redirect: (url: string) => void }) {
    const result = await this.email.trackEvent('click', token, { userAgent: req.headers?.['user-agent'], ipAddress: req.ip, url });
    res.redirect(result.redirectUrl || '/');
  }

  @Get('unsubscribe/:token')
  unsubscribe(@Param('token') token: string) {
    return this.email.handleUnsubscribe(token);
  }

  @Get('confirm-optin/:token')
  confirmOptIn(@Param('token') token: string) {
    return this.email.confirmOptIn(token);
  }

  @Get('preferences/:token')
  async preferences(@Param('token') token: string) {
    const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
    const record = await this.email['prisma'].unsubscribeToken.findUnique({ where: { tokenHash } });
    if (!record) throw new BadRequestException('Invalid token');
    return this.email.getPreferences(record.tenantId, record.email);
  }

  @Post('preferences/:token')
  async updatePreferences(@Param('token') token: string, @Body() body: { preferences: Array<{ category: string; subscribed: boolean }> }, @Req() req: { headers?: Record<string, string>; ip?: string }) {
    return this.email.handlePreferenceCenterUpdate(token, body.preferences, { ipAddress: req.ip, userAgent: req.headers?.['user-agent'] });
  }
}

@Controller('email/compliance')
@RequireService('email_marketing')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class ComplianceController {
  constructor(private readonly email: EmailService) {}

  @Get()
  logs(@CurrentUser() user: AuthenticatedUser, @Query('email') email: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.getComplianceLogs(tenantId(user, selectedTenantId), email || undefined);
  }
}

@Controller('email/reports')
@RequireService('email_marketing')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class ScheduledReportsController {
  constructor(private readonly email: EmailService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.listScheduledReports(tenantId(user, selectedTenantId));
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.createScheduledReport(tenantId(user, selectedTenantId), user.id, body);
  }

  @Post(':id/toggle')
  toggle(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.toggleScheduledReport(tenantId(user, selectedTenantId), id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.email.deleteScheduledReport(tenantId(user, selectedTenantId), id);
  }
}

@Controller('webhooks/email')
export class EmailWebhookController {
  constructor(private readonly email: EmailService) {}

  @Post('sendgrid')
  sendgrid(@Body() body: unknown, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.email.handleProviderEvents(body, headers);
  }
}
