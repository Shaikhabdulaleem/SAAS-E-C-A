import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Headers, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireService } from '../auth/decorators/required-service.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ServiceAccessGuard } from '../auth/guards/service-access.guard';
import { AuthenticatedUser } from '../auth/types';
import { ColdEmailService } from './cold-email.service';

function tenantId(user: AuthenticatedUser, selectedTenantId?: string) {
  if (user.tenantId) return user.tenantId;
  if (user.role === UserRole.superadmin && selectedTenantId) return selectedTenantId;
  throw new BadRequestException('Tenant context is required');
}

@Controller('cold-email/domains')
@RequireService('cold_email')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class SendingDomainsController {
  constructor(private readonly coldEmail: ColdEmailService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.listDomains(tenantId(user, selectedTenantId));
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.addDomain(tenantId(user, selectedTenantId), body);
  }

  @Post('bulk')
  bulkCreate(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.bulkAddDomains(tenantId(user, selectedTenantId), body);
  }

  @Post(':domainId/verify')
  verify(@CurrentUser() user: AuthenticatedUser, @Param('domainId') domainId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.verifyDomain(tenantId(user, selectedTenantId), domainId, user.id);
  }

  @Patch(':domainId/dns-records')
  updateDnsRecords(@CurrentUser() user: AuthenticatedUser, @Param('domainId') domainId: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.updateDnsRecords(tenantId(user, selectedTenantId), domainId, body, user.id);
  }

  @Delete(':domainId')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('domainId') domainId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.removeDomain(tenantId(user, selectedTenantId), domainId);
  }
}

@Controller('cold-email/mailboxes')
@RequireService('cold_email')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class ColdMailboxController {
  constructor(private readonly coldEmail: ColdEmailService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.listMailboxes(tenantId(user, selectedTenantId));
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.createMailbox(tenantId(user, selectedTenantId), body);
  }

  @Post('test-smtp')
  testSmtp(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>) {
    return this.coldEmail.testSmtpConnection(body);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.updateMailbox(tenantId(user, selectedTenantId), id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.removeMailbox(tenantId(user, selectedTenantId), id);
  }

  @Post(':id/toggle-warmup')
  toggleWarmup(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.toggleWarmup(tenantId(user, selectedTenantId), id);
  }

  @Post(':id/pause')
  pause(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.pauseMailbox(tenantId(user, selectedTenantId), id);
  }

  @Post(':id/activate')
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.activateMailbox(tenantId(user, selectedTenantId), id);
  }
}

@Controller('cold-email/prospect-lists')
@RequireService('cold_email')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class ColdProspectListController {
  constructor(private readonly coldEmail: ColdEmailService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.listProspectLists(tenantId(user, selectedTenantId));
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.createProspectList(tenantId(user, selectedTenantId), user.id, body);
  }

  @Get(':listId')
  get(@CurrentUser() user: AuthenticatedUser, @Param('listId') listId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.getProspectList(tenantId(user, selectedTenantId), listId);
  }

  @Delete(':listId')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('listId') listId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.removeProspectList(tenantId(user, selectedTenantId), listId);
  }

  @Post(':listId/prospects')
  addProspects(@CurrentUser() user: AuthenticatedUser, @Param('listId') listId: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.bulkAddProspects(tenantId(user, selectedTenantId), listId, body);
  }

  @Get(':listId/prospects')
  listProspects(@CurrentUser() user: AuthenticatedUser, @Param('listId') listId: string, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.listProspects(tenantId(user, selectedTenantId), listId, query);
  }

  @Delete(':listId/prospects/:prospectId')
  removeProspect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('listId') listId: string,
    @Param('prospectId') prospectId: string,
    @Headers('x-tenant-id') selectedTenantId?: string,
  ) {
    return this.coldEmail.removeProspect(tenantId(user, selectedTenantId), listId, prospectId);
  }
}

@Controller('cold-email/campaigns')
@RequireService('cold_email')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class ColdCampaignController {
  constructor(private readonly coldEmail: ColdEmailService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.listCampaigns(tenantId(user, selectedTenantId), query);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.createCampaign(tenantId(user, selectedTenantId), user.id, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.getCampaign(tenantId(user, selectedTenantId), id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.updateCampaign(tenantId(user, selectedTenantId), id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.deleteCampaign(tenantId(user, selectedTenantId), id);
  }

  @Post(':id/steps')
  setSteps(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.setSequenceSteps(tenantId(user, selectedTenantId), id, body);
  }

  @Post(':id/mailboxes')
  setMailboxes(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.setCampaignMailboxes(tenantId(user, selectedTenantId), id, body);
  }

  @Post(':id/activate')
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.activateCampaign(tenantId(user, selectedTenantId), id);
  }

  @Post(':id/pause')
  pause(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.pauseCampaign(tenantId(user, selectedTenantId), id);
  }

  @Get(':id/analytics')
  analytics(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.getCampaignAnalytics(tenantId(user, selectedTenantId), id);
  }

  @Post(':id/test-send')
  testSend(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.testSend(tenantId(user, selectedTenantId), id, body);
  }

  @Post(':id/duplicate')
  duplicate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.duplicateCampaign(tenantId(user, selectedTenantId), id);
  }
}

@Controller('cold-email/send-engine')
@RequireService('cold_email')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class ColdSendEngineController {
  constructor(private readonly coldEmail: ColdEmailService) {}

  @Get(':campaignId/status')
  status(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.sendEngineState(tenantId(user, selectedTenantId), campaignId);
  }

  @Post(':campaignId/events')
  event(@CurrentUser() user: AuthenticatedUser, @Param('campaignId') campaignId: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.ingestEvent(tenantId(user, selectedTenantId), campaignId, body);
  }
}

// ── Webhook (no auth — server-to-server from SendGrid) ──

@Controller('webhooks/cold-email')
export class ColdEmailWebhookController {
  constructor(private readonly coldEmail: ColdEmailService) {}

  @Post('sendgrid')
  async handleSendGridEvents(@Body() body: unknown) {
    return this.coldEmail.handleSendGridWebhook(body);
  }
}

// ── Email Finder ──

@Controller('cold-email/email-finder')
@RequireService('cold_email')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class EmailFinderController {
  constructor(private readonly coldEmail: ColdEmailService) {}

  @Get('credential')
  getCredential(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.getEmailFinderCredential(tenantId(user, selectedTenantId));
  }

  @Post('credential')
  saveCredential(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.saveEmailFinderCredential(tenantId(user, selectedTenantId), body);
  }

  @Delete('credential')
  deleteCredential(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.deleteEmailFinderCredential(tenantId(user, selectedTenantId));
  }

  @Post('search')
  search(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.searchEmailFinder(tenantId(user, selectedTenantId), body);
  }

  @Post('save-to-list')
  saveToList(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.saveEmailFinderResultsToProspectList(tenantId(user, selectedTenantId), user.id, body);
  }

  @Post('save-to-crm')
  saveToCrm(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.saveEmailFinderResultsToCrm(tenantId(user, selectedTenantId), user.id, body);
  }
}

// ── Reply Inbox ──

@Controller('cold-email/replies')
@RequireService('cold_email')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class ColdReplyController {
  constructor(private readonly coldEmail: ColdEmailService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.listReplies(tenantId(user, selectedTenantId), query);
  }

  @Get('stats')
  stats(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.getReplyStats(tenantId(user, selectedTenantId));
  }

  @Patch(':id/categorize')
  categorize(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.categorizeReply(tenantId(user, selectedTenantId), id, body);
  }

  @Patch(':id/assign')
  assign(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.assignReply(tenantId(user, selectedTenantId), id, body);
  }

  @Post(':id/responded')
  markResponded(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.markReplyResponded(tenantId(user, selectedTenantId), id);
  }

  @Post(':id/create-deal')
  createDeal(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.createDealFromReply(tenantId(user, selectedTenantId), id, user.id);
  }
}

// ── Sequence Templates ──

@Controller('cold-email/sequence-templates')
@RequireService('cold_email')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class ColdSequenceTemplateController {
  constructor(private readonly coldEmail: ColdEmailService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.listSequenceTemplates(tenantId(user, selectedTenantId));
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.createSequenceTemplate(tenantId(user, selectedTenantId), user.id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.deleteSequenceTemplate(tenantId(user, selectedTenantId), id);
  }
}

// ── Suppression List ──

@Controller('cold-email/suppressions')
@RequireService('cold_email')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class ColdSuppressionController {
  constructor(private readonly coldEmail: ColdEmailService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.listSuppressions(tenantId(user, selectedTenantId), query);
  }

  @Post()
  add(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.addSuppression(tenantId(user, selectedTenantId), body);
  }

  @Post('bulk')
  bulkAdd(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.bulkAddSuppressions(tenantId(user, selectedTenantId), body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.removeSuppression(tenantId(user, selectedTenantId), id);
  }
}

// ── Self-service Integrations (client-side) ──

@Controller('cold-email/integrations')
@RequireService('cold_email')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class ColdEmailIntegrationsController {
  constructor(private readonly coldEmail: ColdEmailService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.listIntegrations(tenantId(user, selectedTenantId));
  }

  @Post()
  connect(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.connectIntegration(tenantId(user, selectedTenantId), body);
  }

  @Delete(':platformKey')
  disconnect(@CurrentUser() user: AuthenticatedUser, @Param('platformKey') platformKey: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.disconnectIntegration(tenantId(user, selectedTenantId), platformKey);
  }
}
