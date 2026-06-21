import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireService } from '../auth/decorators/required-service.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ServiceAccessGuard } from '../auth/guards/service-access.guard';
import { AuthenticatedUser } from '../auth/types';
import { resolveTenantId } from '../common/tenant-context';
import { ProposalsService } from './proposals.service';
import { ProposalPdfService } from './proposal-pdf.service';
import { ProposalEmailService } from './proposal-email.service';
import { ProposalActivityService } from './proposal-activity.service';
import { ProposalTemplateService } from './proposal-template.service';
import { PROPOSAL_TEMPLATES } from './templates';

// ── Client (Tenant-scoped) ────────────────────────────────────────────────────

@Controller('proposals')
@RequireService('proposals')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class ProposalsController {
  constructor(
    private readonly proposals: ProposalsService,
    private readonly pdf: ProposalPdfService,
    private readonly email: ProposalEmailService,
    private readonly activity: ProposalActivityService,
    private readonly presets: ProposalTemplateService,
  ) {}

  @Get('templates')
  templates() {
    return Object.values(PROPOSAL_TEMPLATES).map((t) => ({ id: t.id, name: t.name, description: t.description }));
  }

  @Get('template-presets')
  listPresets(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.presets.listTenant(resolveTenantId(user, selectedTenantId, adminImpersonation));
  }

  @Post('template-presets')
  createPreset(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.presets.createTenant(resolveTenantId(user, selectedTenantId, adminImpersonation), user.id, body);
  }

  @Get('template-presets/:presetId')
  getPreset(@CurrentUser() user: AuthenticatedUser, @Param('presetId') presetId: string, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.presets.getTenant(resolveTenantId(user, selectedTenantId, adminImpersonation), presetId);
  }

  @Patch('template-presets/:presetId')
  updatePreset(@CurrentUser() user: AuthenticatedUser, @Param('presetId') presetId: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.presets.updateTenant(resolveTenantId(user, selectedTenantId, adminImpersonation), presetId, body);
  }

  @Delete('template-presets/:presetId')
  removePreset(@CurrentUser() user: AuthenticatedUser, @Param('presetId') presetId: string, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.presets.removeTenant(resolveTenantId(user, selectedTenantId, adminImpersonation), presetId);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.proposals.listTenant(resolveTenantId(user, selectedTenantId, adminImpersonation), query);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.proposals.createTenant(resolveTenantId(user, selectedTenantId, adminImpersonation), user.id, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.proposals.getTenant(resolveTenantId(user, selectedTenantId, adminImpersonation), id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.proposals.updateTenant(resolveTenantId(user, selectedTenantId, adminImpersonation), id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.proposals.removeTenant(resolveTenantId(user, selectedTenantId, adminImpersonation), id);
  }

  @Post(':id/send')
  async send(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    const tenantId = resolveTenantId(user, selectedTenantId, adminImpersonation);
    await this.proposals.getTenant(tenantId, id);
    return this.email.sendProposal(id, {
      toEmail: body.toEmail as string,
      ccEmail: body.ccEmail as string | undefined,
      subject: body.subject as string,
      message: body.message as string,
      actorId: user.id,
      actorType: 'client',
      baseUrl: (body.baseUrl as string) || process.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5173',
    });
  }

  @Post(':id/duplicate')
  duplicate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.proposals.duplicateTenant(resolveTenantId(user, selectedTenantId, adminImpersonation), id, user.id);
  }

  @Get(':id/preview')
  async preview(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.proposals.getTenant(resolveTenantId(user, selectedTenantId, adminImpersonation), id);
  }

  @Post(':id/generate-pdf')
  async generatePdf(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    await this.proposals.getTenant(resolveTenantId(user, selectedTenantId, adminImpersonation), id);
    const pdfUrl = await this.pdf.generate(id);
    return { pdfUrl };
  }

  @Get(':id/download-pdf')
  async downloadPdf(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Res() res: Response, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    await this.proposals.getTenant(resolveTenantId(user, selectedTenantId, adminImpersonation), id);
    const filePath = this.pdf.getFilePath(id);
    if (!filePath) return res.status(404).json({ data: null, meta: {}, error: { code: 'NOT_FOUND', message: 'PDF not generated yet' } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="proposal-${id}.pdf"`);
    res.sendFile(filePath);
  }

  @Get(':id/activities')
  async activities(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    await this.proposals.getTenant(resolveTenantId(user, selectedTenantId, adminImpersonation), id);
    return this.activity.list(id);
  }

  @Patch(':id/status')
  async updateStatus(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    await this.proposals.getTenant(resolveTenantId(user, selectedTenantId, adminImpersonation), id);
    return this.proposals.updateStatus(id, body.status as string);
  }
}

// ── Admin (MCC Super Admin) ───────────────────────────────────────────────────

@Controller('admin/proposals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class AdminProposalsController {
  constructor(
    private readonly proposals: ProposalsService,
    private readonly pdf: ProposalPdfService,
    private readonly email: ProposalEmailService,
    private readonly activity: ProposalActivityService,
    private readonly presets: ProposalTemplateService,
  ) {}

  @Get('analytics')
  analytics() {
    return this.proposals.getAdminAnalytics();
  }

  @Get('stats')
  stats() {
    return this.proposals.getAdminStats();
  }

  @Get('template-presets')
  listPresets() {
    return this.presets.listAdmin();
  }

  @Post('template-presets')
  createPreset(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>) {
    return this.presets.createAdmin(user.id, body);
  }

  @Patch('template-presets/:presetId')
  updatePreset(@Param('presetId') presetId: string, @Body() body: Record<string, unknown>) {
    return this.presets.updateAdmin(presetId, body);
  }

  @Delete('template-presets/:presetId')
  removePreset(@Param('presetId') presetId: string) {
    return this.presets.removeAdmin(presetId);
  }

  @Get()
  list(@Query() query: Record<string, string>) {
    return this.proposals.listAdmin(query);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>) {
    return this.proposals.createAdmin(user.id, body);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.proposals.getAdmin(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.proposals.updateAdmin(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.proposals.removeAdmin(id);
  }

  @Post(':id/send')
  async send(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    await this.proposals.getAdmin(id);
    return this.email.sendProposal(id, {
      toEmail: body.toEmail as string,
      subject: body.subject as string,
      message: body.message as string,
      actorId: user.id,
      actorType: 'admin',
      baseUrl: (body.baseUrl as string) || process.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5173',
    });
  }

  @Post(':id/duplicate')
  duplicate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.proposals.duplicateAdmin(id, user.id);
  }

  @Post(':id/generate-pdf')
  async generatePdf(@Param('id') id: string) {
    await this.proposals.getAdmin(id);
    const pdfUrl = await this.pdf.generate(id);
    return { pdfUrl };
  }

  @Get(':id/download-pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    await this.proposals.getAdmin(id);
    const filePath = this.pdf.getFilePath(id);
    if (!filePath) return res.status(404).json({ data: null, meta: {}, error: { code: 'NOT_FOUND', message: 'PDF not generated yet' } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="proposal-${id}.pdf"`);
    res.sendFile(filePath);
  }

  @Get(':id/activities')
  async activities(@Param('id') id: string) {
    await this.proposals.getAdmin(id);
    return this.activity.list(id);
  }

  @Post(':id/convert-to-client')
  convert(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.proposals.convertAdminProposalToClient(id, user.id);
  }
}
