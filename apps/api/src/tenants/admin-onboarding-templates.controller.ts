import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types';
import { AdminOnboardingTemplatesService } from './admin-onboarding-templates.service';

@Controller('admin/onboarding-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class AdminOnboardingTemplatesController {
  constructor(private readonly templates: AdminOnboardingTemplatesService) {}

  @Get()
  list() { return this.templates.list(); }

  @Post()
  create(@Body() body: { name: string; description?: string; items: unknown[]; isDefault?: boolean }) {
    return this.templates.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { name?: string; description?: string; items?: unknown[]; isDefault?: boolean }) {
    return this.templates.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.templates.remove(id); }

  @Post('apply/:tenantId/:templateId')
  apply(@Param('tenantId') tenantId: string, @Param('templateId') templateId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.templates.applyTemplate(tenantId, templateId, user.id);
  }
}
