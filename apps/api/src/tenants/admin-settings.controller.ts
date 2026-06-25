import { BadRequestException, Body, Controller, Delete, Get, Post, Put, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { imageUploadOptions, saveUploadedFile, deleteUploadedFile } from '../common/file-upload.util';
import { AdminSettingsService } from './admin-settings.service';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class AdminSettingsController {
  constructor(private readonly settings: AdminSettingsService) {}

  @Get()
  get() { return this.settings.getSettings(); }

  @Put()
  update(@Body() body: Record<string, unknown>) { return this.settings.updateSettings(body); }

  @Post('logo')
  @UseInterceptors(FileInterceptor('logo', imageUploadOptions()))
  async uploadLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Logo file is required');
    const existing = await this.settings.getSettings();
    const logoUrl = saveUploadedFile(file, 'logos');
    if (existing?.logoUrl) deleteUploadedFile(existing.logoUrl);
    return this.settings.updateSettings({ logoUrl });
  }

  @Delete('logo')
  async removeLogo() {
    const existing = await this.settings.getSettings();
    if (existing?.logoUrl) deleteUploadedFile(existing.logoUrl);
    return this.settings.updateSettings({ logoUrl: '' });
  }
}
