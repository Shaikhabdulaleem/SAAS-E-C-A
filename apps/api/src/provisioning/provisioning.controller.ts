import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Headers, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireService } from '../auth/decorators/required-service.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ServiceAccessGuard } from '../auth/guards/service-access.guard';
import { AuthenticatedUser } from '../auth/types';
import { ProvisioningService } from './provisioning.service';

function tenantId(user: AuthenticatedUser, selectedTenantId?: string) {
  if (user.tenantId) return user.tenantId;
  if (user.role === UserRole.superadmin && selectedTenantId) return selectedTenantId;
  throw new BadRequestException('Tenant context is required');
}

@Controller('provisioning')
@RequireService('cold_email')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class ProvisioningController {
  constructor(private readonly provisioning: ProvisioningService) {}

  // ── Domain Purchase Pipeline (Inframail) ──────────────────────────

  @Post('domain-purchase/orders')
  createPurchaseOrder(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.createDomainPurchaseOrder(tenantId(user, selectedTenantId), user.id, body);
  }

  @Get('domain-purchase/orders')
  listPurchaseOrders(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.listDomainPurchaseOrders(tenantId(user, selectedTenantId));
  }

  @Get('domain-purchase/orders/:orderId')
  getPurchaseOrder(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.getDomainPurchaseOrder(tenantId(user, selectedTenantId), orderId);
  }

  @Post('domain-purchase/orders/:orderId/confirm')
  confirmPurchaseOrder(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.confirmDomainSelection(tenantId(user, selectedTenantId), orderId, body);
  }

  @Post('domain-purchase/orders/:orderId/retry')
  retryPurchaseOrder(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.retryFailedDomains(tenantId(user, selectedTenantId), orderId);
  }

  // ── Provider Credentials ───────────────────────────────────────────

  @Post('providers/connect')
  connectProvider(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.connectProvider(tenantId(user, selectedTenantId), body);
  }

  @Get('providers')
  listProviders(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.listProviders(tenantId(user, selectedTenantId));
  }

  @Delete('providers/:id')
  disconnectProvider(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.disconnectProvider(tenantId(user, selectedTenantId), id);
  }

  // ── Domain Management with Volume ──────────────────────────────────

  @Post('domains')
  addDomain(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.addDomainWithVolume(tenantId(user, selectedTenantId), body);
  }

  @Patch('domains/:domainId/volume')
  updateDomainVolume(@CurrentUser() user: AuthenticatedUser, @Param('domainId') domainId: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.updateDomainVolume(tenantId(user, selectedTenantId), domainId, body);
  }

  @Get('domains')
  listDomains(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.listDomainsWithVolume(tenantId(user, selectedTenantId));
  }

  // ── Auto Provision Mailboxes (via Provider API) ────────────────────

  @Post('domains/:domainId/auto-provision')
  autoProvision(@CurrentUser() user: AuthenticatedUser, @Param('domainId') domainId: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.autoProvisionDomain(tenantId(user, selectedTenantId), domainId, body);
  }

  // ── DNS Configuration ─────────────────────────────────────────────

  @Post('domains/:domainId/dns/connect')
  connectDns(@CurrentUser() user: AuthenticatedUser, @Param('domainId') domainId: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.connectDomainDns(tenantId(user, selectedTenantId), domainId, body);
  }

  @Post('domains/:domainId/dns/auto-configure')
  autoConfigureDns(@CurrentUser() user: AuthenticatedUser, @Param('domainId') domainId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.autoConfigureDns(tenantId(user, selectedTenantId), domainId);
  }

  // ── Warmup Health Enforcement ─────────────────────────────────────

  @Post('warmup/check-health')
  checkWarmupHealth(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.checkWarmupHealth(tenantId(user, selectedTenantId));
  }

  @Get('mailboxes/:mailboxId/can-send')
  canSend(@CurrentUser() user: AuthenticatedUser, @Param('mailboxId') mailboxId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.canSendCampaign(tenantId(user, selectedTenantId), mailboxId);
  }

  // ── Smart Distribution ────────────────────────────────────────────

  @Get('smart-distribution')
  smartDistribution(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.getSmartDistribution(tenantId(user, selectedTenantId));
  }

  // ── Original Endpoints (preserved) ────────────────────────────────

  @Post('calculate')
  calculate(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.calculate(tenantId(user, selectedTenantId), body);
  }

  @Post('provision')
  provision(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.provision(tenantId(user, selectedTenantId), body);
  }

  @Get('personas')
  listPersonas(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.listPersonas(tenantId(user, selectedTenantId));
  }

  @Get('personas/:id')
  getPersona(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.getPersona(tenantId(user, selectedTenantId), id);
  }

  @Patch('personas/:id')
  updatePersona(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.updatePersona(tenantId(user, selectedTenantId), id, body);
  }

  @Delete('personas/:id')
  deletePersona(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.deletePersona(tenantId(user, selectedTenantId), id);
  }

  @Patch('personas/:id/linkedin')
  updateLinkedIn(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.updateLinkedInSlot(tenantId(user, selectedTenantId), id, body);
  }

  @Get('domain-health')
  listDomainHealth(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.listDomainHealth(tenantId(user, selectedTenantId));
  }

  @Get('domain-health/:domainId')
  getDomainHealth(@CurrentUser() user: AuthenticatedUser, @Param('domainId') domainId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.getDomainHealth(tenantId(user, selectedTenantId), domainId);
  }

  @Post('domain-health/:domainId/check')
  checkDomainHealth(@CurrentUser() user: AuthenticatedUser, @Param('domainId') domainId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.checkDomainHealth(tenantId(user, selectedTenantId), domainId);
  }

  @Get('warmup')
  warmupDashboard(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.getWarmupDashboard(tenantId(user, selectedTenantId));
  }

  @Post('warmup/:personaId/advance')
  advanceWarmup(@CurrentUser() user: AuthenticatedUser, @Param('personaId') personaId: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.advanceWarmup(tenantId(user, selectedTenantId), personaId);
  }

  @Get('distribution')
  distribution(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.provisioning.getDistribution(tenantId(user, selectedTenantId));
  }
}
