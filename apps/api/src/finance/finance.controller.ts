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
import { FinanceEmailService } from './finance-email.service';
import { FinancePdfService } from './finance-pdf.service';
import { FinanceService } from './finance.service';
import { INVOICE_TEMPLATES } from './templates';

@Controller('finance')
@RequireService('finance')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly pdf: FinancePdfService,
    private readonly email: FinanceEmailService,
  ) {}

  @Get('invoice-templates')
  invoiceTemplates() {
    return Object.values(INVOICE_TEMPLATES).map((t) => ({ id: t.id, name: t.name, description: t.description }));
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.summary('client', resolveTenantId(user, selectedTenantId, adminImpersonation));
  }

  @Get('analytics')
  analytics(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.analytics('client', resolveTenantId(user, selectedTenantId, adminImpersonation));
  }

  @Get('settings')
  settings(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.settings('client', resolveTenantId(user, selectedTenantId, adminImpersonation));
  }

  @Patch('settings')
  updateSettings(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.updateSettings('client', resolveTenantId(user, selectedTenantId, adminImpersonation), body);
  }

  @Get('invoices')
  invoices(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.listInvoices('client', resolveTenantId(user, selectedTenantId, adminImpersonation), query);
  }

  @Post('invoices')
  createInvoice(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.createInvoice('client', resolveTenantId(user, selectedTenantId, adminImpersonation), user.id, body);
  }

  @Get('invoices/:id')
  getInvoice(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.getInvoice('client', resolveTenantId(user, selectedTenantId, adminImpersonation), id);
  }

  @Patch('invoices/:id')
  updateInvoice(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.updateInvoice('client', resolveTenantId(user, selectedTenantId, adminImpersonation), id, body);
  }

  @Delete('invoices/:id')
  deleteInvoice(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.deleteInvoice('client', resolveTenantId(user, selectedTenantId, adminImpersonation), id);
  }

  @Post('invoices/:id/duplicate')
  duplicateInvoice(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.duplicateInvoice('client', resolveTenantId(user, selectedTenantId, adminImpersonation), id, user.id);
  }

  @Post('invoices/:id/mark-paid')
  markPaid(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.markPaid('client', resolveTenantId(user, selectedTenantId, adminImpersonation), id, user.id, body);
  }

  @Post('invoices/:id/void')
  voidInvoice(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.voidInvoice('client', resolveTenantId(user, selectedTenantId, adminImpersonation), id, user.id, body);
  }

  @Post('invoices/:id/generate-pdf')
  async generatePdf(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    await this.finance.getInvoice('client', resolveTenantId(user, selectedTenantId, adminImpersonation), id);
    const pdfUrl = await this.pdf.generate(id, { actorType: 'client', actorId: user.id });
    return { pdfUrl };
  }

  @Get('invoices/:id/download-pdf')
  async downloadPdf(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Res() res: Response, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    await this.finance.getInvoice('client', resolveTenantId(user, selectedTenantId, adminImpersonation), id);
    const filePath = this.pdf.getFilePath(id) ?? await this.pdf.generate(id, { actorType: 'client', actorId: user.id }).then(() => this.pdf.getFilePath(id));
    if (!filePath) return res.status(404).json({ data: null, meta: {}, error: { code: 'NOT_FOUND', message: 'PDF not generated yet' } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}.pdf"`);
    res.sendFile(filePath);
  }

  @Post('invoices/:id/send')
  async send(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    await this.finance.getInvoice('client', resolveTenantId(user, selectedTenantId, adminImpersonation), id);
    return this.email.sendInvoice(id, { toEmail: body.toEmail as string | undefined, subject: body.subject as string | undefined, message: body.message as string | undefined, baseUrl: body.baseUrl as string | undefined, actorType: 'client', actorId: user.id });
  }

  @Post('invoices/from-proposal/:proposalId')
  convertProposal(@CurrentUser() user: AuthenticatedUser, @Param('proposalId') proposalId: string, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.convertProposalToInvoice('client', resolveTenantId(user, selectedTenantId, adminImpersonation), proposalId, user.id);
  }

  @Get('payments')
  payments(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.listPayments('client', resolveTenantId(user, selectedTenantId, adminImpersonation), query);
  }

  @Post('payments')
  createPayment(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.createPayment('client', resolveTenantId(user, selectedTenantId, adminImpersonation), user.id, body);
  }

  @Get('costs')
  costs(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.listCosts('client', resolveTenantId(user, selectedTenantId, adminImpersonation), query);
  }

  @Post('costs')
  createCost(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.createCost('client', resolveTenantId(user, selectedTenantId, adminImpersonation), user.id, body);
  }

  @Patch('costs/:id')
  updateCost(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.updateCost('client', resolveTenantId(user, selectedTenantId, adminImpersonation), id, body);
  }

  @Delete('costs/:id')
  deleteCost(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.deleteCost('client', resolveTenantId(user, selectedTenantId, adminImpersonation), id);
  }

  @Get('subscriptions')
  subscriptions(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.listSubscriptions('client', resolveTenantId(user, selectedTenantId, adminImpersonation));
  }

  @Post('subscriptions')
  createSubscription(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.createSubscription('client', resolveTenantId(user, selectedTenantId, adminImpersonation), user.id, body);
  }

  @Get('refunds')
  refunds(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.listRefunds('client', resolveTenantId(user, selectedTenantId, adminImpersonation));
  }

  @Post('refunds')
  createRefund(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.createRefund('client', resolveTenantId(user, selectedTenantId, adminImpersonation), user.id, body);
  }

  @Get('tax-configs')
  taxConfigs(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.listTaxConfigs('client', resolveTenantId(user, selectedTenantId, adminImpersonation));
  }

  @Post('tax-configs')
  createTaxConfig(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.createTaxConfig('client', resolveTenantId(user, selectedTenantId, adminImpersonation), body);
  }

  @Post('jobs/flag-overdue')
  processOverdue(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string, @Headers('x-admin-impersonation') adminImpersonation?: string) {
    return this.finance.processOverdue('client', resolveTenantId(user, selectedTenantId, adminImpersonation));
  }
}

@Controller('admin/finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class AdminFinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly pdf: FinancePdfService,
    private readonly email: FinanceEmailService,
  ) {}

  @Get('summary')
  summary(@Query('tenantId') tenantId?: string) {
    return this.finance.summary('mcc', tenantId);
  }

  @Get('analytics')
  analytics(@Query('tenantId') tenantId?: string) {
    return this.finance.analytics('mcc', tenantId);
  }

  @Get('settings')
  settings() {
    return this.finance.settings('mcc');
  }

  @Patch('settings')
  updateSettings(@Body() body: Record<string, unknown>) {
    return this.finance.updateSettings('mcc', undefined, body);
  }

  @Get('invoices')
  invoices(@Query() query: Record<string, string>) {
    return this.finance.listInvoices('mcc', query.tenantId, query);
  }

  @Post('invoices')
  createInvoice(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>) {
    return this.finance.createInvoice('mcc', undefined, user.id, body);
  }

  @Get('invoices/:id')
  getInvoice(@Param('id') id: string, @Query('tenantId') tenantId?: string) {
    return this.finance.getInvoice('mcc', tenantId, id);
  }

  @Patch('invoices/:id')
  updateInvoice(@Param('id') id: string, @Body() body: Record<string, unknown>, @Query('tenantId') tenantId?: string) {
    return this.finance.updateInvoice('mcc', tenantId, id, body);
  }

  @Delete('invoices/:id')
  deleteInvoice(@Param('id') id: string, @Query('tenantId') tenantId?: string) {
    return this.finance.deleteInvoice('mcc', tenantId, id);
  }

  @Post('invoices/:id/duplicate')
  duplicateInvoice(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Query('tenantId') tenantId?: string) {
    return this.finance.duplicateInvoice('mcc', tenantId, id, user.id);
  }

  @Post('invoices/:id/mark-paid')
  markPaid(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Query('tenantId') tenantId?: string) {
    return this.finance.markPaid('mcc', tenantId, id, user.id, body);
  }

  @Post('invoices/:id/void')
  voidInvoice(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Query('tenantId') tenantId?: string) {
    return this.finance.voidInvoice('mcc', tenantId, id, user.id, body);
  }

  @Post('invoices/:id/generate-pdf')
  async generatePdf(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Query('tenantId') tenantId?: string) {
    await this.finance.getInvoice('mcc', tenantId, id);
    const pdfUrl = await this.pdf.generate(id, { actorType: 'mcc_admin', actorId: user.id });
    return { pdfUrl };
  }

  @Get('invoices/:id/download-pdf')
  async downloadPdf(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Res() res: Response, @Query('tenantId') tenantId?: string) {
    await this.finance.getInvoice('mcc', tenantId, id);
    const filePath = this.pdf.getFilePath(id) ?? await this.pdf.generate(id, { actorType: 'mcc_admin', actorId: user.id }).then(() => this.pdf.getFilePath(id));
    if (!filePath) return res.status(404).json({ data: null, meta: {}, error: { code: 'NOT_FOUND', message: 'PDF not generated yet' } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}.pdf"`);
    res.sendFile(filePath);
  }

  @Post('invoices/:id/send')
  async send(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Query('tenantId') tenantId?: string) {
    await this.finance.getInvoice('mcc', tenantId, id);
    return this.email.sendInvoice(id, { toEmail: body.toEmail as string | undefined, subject: body.subject as string | undefined, message: body.message as string | undefined, baseUrl: body.baseUrl as string | undefined, actorType: 'mcc_admin', actorId: user.id });
  }

  @Post('invoices/from-proposal/:proposalId')
  convertProposal(@CurrentUser() user: AuthenticatedUser, @Param('proposalId') proposalId: string) {
    return this.finance.convertProposalToInvoice('mcc', undefined, proposalId, user.id);
  }

  @Get('payments')
  payments(@Query() query: Record<string, string>) {
    return this.finance.listPayments('mcc', query.tenantId, query);
  }

  @Post('payments')
  createPayment(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>) {
    return this.finance.createPayment('mcc', undefined, user.id, body);
  }

  @Get('costs')
  costs(@Query() query: Record<string, string>) {
    return this.finance.listCosts('mcc', query.tenantId, query);
  }

  @Post('costs')
  createCost(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>) {
    return this.finance.createCost('mcc', undefined, user.id, body);
  }

  @Patch('costs/:id')
  updateCost(@Param('id') id: string, @Body() body: Record<string, unknown>, @Query('tenantId') tenantId?: string) {
    return this.finance.updateCost('mcc', tenantId, id, body);
  }

  @Delete('costs/:id')
  deleteCost(@Param('id') id: string, @Query('tenantId') tenantId?: string) {
    return this.finance.deleteCost('mcc', tenantId, id);
  }

  @Get('subscriptions')
  subscriptions(@Query('tenantId') tenantId?: string) {
    return this.finance.listSubscriptions('mcc', tenantId);
  }

  @Post('subscriptions')
  createSubscription(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>) {
    return this.finance.createSubscription('mcc', undefined, user.id, body);
  }

  @Get('refunds')
  refunds(@Query('tenantId') tenantId?: string) {
    return this.finance.listRefunds('mcc', tenantId);
  }

  @Post('refunds')
  createRefund(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Query('tenantId') tenantId?: string) {
    return this.finance.createRefund('mcc', tenantId, user.id, body);
  }

  @Get('tax-configs')
  taxConfigs(@Query('tenantId') tenantId?: string) {
    return this.finance.listTaxConfigs('mcc', tenantId);
  }

  @Post('tax-configs')
  createTaxConfig(@Body() body: Record<string, unknown>) {
    return this.finance.createTaxConfig('mcc', undefined, body);
  }

  @Post('jobs/flag-overdue')
  processOverdue(@Query('tenantId') tenantId?: string) {
    return this.finance.processOverdue('mcc', tenantId);
  }
}

@Controller('public/invoices')
export class PublicFinanceInvoiceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly pdf: FinancePdfService,
  ) {}

  @Get(':token')
  get(@Param('token') token: string) {
    return this.finance.publicInvoice(token, true);
  }

  @Post(':token/viewed')
  viewed(@Param('token') token: string) {
    return this.finance.publicInvoice(token, true);
  }

  @Get(':token/download')
  async download(@Param('token') token: string, @Res() res: Response) {
    const invoice = await this.finance.publicInvoice(token, true);
    const filePath = this.pdf.getFilePath(invoice.id) ?? await this.pdf.generate(invoice.id, { actorType: 'customer' }).then(() => this.pdf.getFilePath(invoice.id));
    if (!filePath) return res.status(404).json({ data: null, meta: {}, error: { code: 'NOT_FOUND', message: 'PDF not generated yet' } });
    res.sendFile(filePath);
  }
}
