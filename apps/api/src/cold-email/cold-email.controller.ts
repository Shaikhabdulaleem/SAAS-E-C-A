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

  @Post(':domainId/verify')
  verify(@CurrentUser() user: AuthenticatedUser, @Param('domainId') domainId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.coldEmail.verifyDomain(tenantId(user, selectedTenantId), domainId);
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
