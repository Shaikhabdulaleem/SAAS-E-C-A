import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireService } from '../auth/decorators/required-service.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ServiceAccessGuard } from '../auth/guards/service-access.guard';
import { AuthenticatedUser } from '../auth/types';
import { CrmService } from './crm.service';

export class TenantScopedController {
  protected tenantId(user: AuthenticatedUser, selectedTenantId?: string) {
    if (user.tenantId) return user.tenantId;
    if (user.role === UserRole.superadmin && selectedTenantId) return selectedTenantId;
    {
      throw new BadRequestException('Tenant context is required');
    }
  }
}

@Controller('contacts')
@RequireService(['crm', 'email_marketing'])
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class ContactsController extends TenantScopedController {
  constructor(private readonly crm: CrmService) { super(); }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.listContacts(this.tenantId(user, selectedTenantId), query);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.createContact(this.tenantId(user, selectedTenantId), user.id, body);
  }

  @Post('import/preview')
  previewImport(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.previewContactImport(this.tenantId(user, selectedTenantId), body);
  }

  @Post('import')
  importContacts(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.importContacts(this.tenantId(user, selectedTenantId), user.id, body);
  }

  @Post('google-sheets/preview')
  previewGoogleSheets(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.previewGoogleSheetsImport(this.tenantId(user, selectedTenantId), body);
  }

  @Post('google-sheets/import')
  importGoogleSheets(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.importGoogleSheetsContacts(this.tenantId(user, selectedTenantId), user.id, body);
  }

  @Post('audience/preview')
  audiencePreview(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.audiencePreview(this.tenantId(user, selectedTenantId), body);
  }

  @Post('send-to-cold-outreach')
  sendToColdOutreach(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.sendContactsToColdOutreach(this.tenantId(user, selectedTenantId), user.id, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.getContact(this.tenantId(user, selectedTenantId), id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.updateContact(this.tenantId(user, selectedTenantId), user.id, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.deleteContact(this.tenantId(user, selectedTenantId), id);
  }
}

@Controller('companies')
@RequireService('crm')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class CompaniesController extends TenantScopedController {
  constructor(private readonly crm: CrmService) { super(); }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.listCompanies(this.tenantId(user, selectedTenantId), query);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.createCompany(this.tenantId(user, selectedTenantId), user.id, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.getCompany(this.tenantId(user, selectedTenantId), id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.updateCompany(this.tenantId(user, selectedTenantId), user.id, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.deleteCompany(this.tenantId(user, selectedTenantId), id);
  }
}

@Controller('deals')
@RequireService('crm')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class DealsController extends TenantScopedController {
  constructor(private readonly crm: CrmService) { super(); }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.listDeals(this.tenantId(user, selectedTenantId), query);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.createDeal(this.tenantId(user, selectedTenantId), user.id, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.getDeal(this.tenantId(user, selectedTenantId), id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.updateDeal(this.tenantId(user, selectedTenantId), user.id, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.deleteDeal(this.tenantId(user, selectedTenantId), id);
  }
}

@Controller('activities')
@RequireService('crm')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class ActivitiesController extends TenantScopedController {
  constructor(private readonly crm: CrmService) { super(); }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.listActivities(this.tenantId(user, selectedTenantId), query);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.createActivity(this.tenantId(user, selectedTenantId), user.id, body);
  }
}

@Controller('pipeline-stages')
@RequireService('crm')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class PipelineStagesController extends TenantScopedController {
  constructor(private readonly crm: CrmService) { super(); }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.listPipelineStages(this.tenantId(user, selectedTenantId));
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.createPipelineStage(this.tenantId(user, selectedTenantId), body);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.updatePipelineStage(this.tenantId(user, selectedTenantId), id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.deletePipelineStage(this.tenantId(user, selectedTenantId), id);
  }

  @Post('reorder')
  reorder(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.reorderPipelineStages(this.tenantId(user, selectedTenantId), body);
  }
}

@Controller('tags')
@RequireService('crm')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class TagsController extends TenantScopedController {
  constructor(private readonly crm: CrmService) { super(); }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.listTags(this.tenantId(user, selectedTenantId));
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.createTag(this.tenantId(user, selectedTenantId), body);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.updateTag(this.tenantId(user, selectedTenantId), id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') selectedTenantId?: string) {
    return this.crm.deleteTag(this.tenantId(user, selectedTenantId), id);
  }
}
