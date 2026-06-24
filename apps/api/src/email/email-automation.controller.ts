import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireService } from '../auth/decorators/required-service.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ServiceAccessGuard } from '../auth/guards/service-access.guard';
import { AuthenticatedUser } from '../auth/types';
import { EmailAutomationService } from './email-automation.service';

function tenantId(user: AuthenticatedUser, selectedTenantId?: string) {
  if (user.tenantId) return user.tenantId;
  if (user.role === UserRole.superadmin && selectedTenantId) return selectedTenantId;
  throw new BadRequestException('Tenant context is required');
}

@Controller('email/automations')
@RequireService('email_marketing')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class EmailAutomationController {
  constructor(private readonly automations: EmailAutomationService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') tid?: string) {
    return this.automations.listAutomations(tenantId(user, tid));
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') tid?: string) {
    return this.automations.createAutomation(tenantId(user, tid), user.id, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') tid?: string) {
    return this.automations.getAutomation(tenantId(user, tid), id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') tid?: string) {
    return this.automations.updateAutomation(tenantId(user, tid), id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') tid?: string) {
    return this.automations.deleteAutomation(tenantId(user, tid), id);
  }

  @Post(':id/activate')
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') tid?: string) {
    return this.automations.activateAutomation(tenantId(user, tid), id);
  }

  @Post(':id/pause')
  pause(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') tid?: string) {
    return this.automations.pauseAutomation(tenantId(user, tid), id);
  }

  @Post(':id/steps')
  addStep(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') tid?: string) {
    return this.automations.addStep(tenantId(user, tid), id, body);
  }

  @Patch(':id/steps/:stepId')
  updateStep(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('stepId') stepId: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') tid?: string) {
    return this.automations.updateStep(tenantId(user, tid), id, stepId, body);
  }

  @Delete(':id/steps/:stepId')
  deleteStep(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('stepId') stepId: string, @Headers('x-tenant-id') tid?: string) {
    return this.automations.deleteStep(tenantId(user, tid), id, stepId);
  }

  @Post(':id/enroll')
  enroll(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') tid?: string) {
    return this.automations.bulkEnroll(tenantId(user, tid), id, body as any);
  }
}

@Controller('email/segments')
@RequireService('email_marketing')
@UseGuards(JwtAuthGuard, ServiceAccessGuard)
export class EmailSegmentController {
  constructor(private readonly automations: EmailAutomationService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Headers('x-tenant-id') tid?: string) {
    return this.automations.listSegments(tenantId(user, tid));
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') tid?: string) {
    return this.automations.createSegment(tenantId(user, tid), user.id, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('x-tenant-id') tid?: string) {
    return this.automations.updateSegment(tenantId(user, tid), id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') tid?: string) {
    return this.automations.deleteSegment(tenantId(user, tid), id);
  }

  @Get(':id/preview')
  preview(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('x-tenant-id') tid?: string) {
    return this.automations.previewSegment(tenantId(user, tid), id);
  }
}
