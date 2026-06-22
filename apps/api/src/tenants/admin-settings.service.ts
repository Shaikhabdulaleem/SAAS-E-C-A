import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    const existing = await this.prisma.mccSetting.findFirst();
    if (existing) return existing;
    return this.prisma.mccSetting.create({ data: {} });
  }

  async updateSettings(data: {
    companyName?: string;
    logoUrl?: string;
    primaryColor?: string;
    supportEmail?: string;
    timezone?: string;
    defaultCurrency?: string;
    notificationSenderName?: string;
    notificationSenderEmail?: string;
    whitelabelEnabled?: boolean;
    whitelabelDomain?: string;
  }) {
    const existing = await this.prisma.mccSetting.findFirst();
    if (existing) {
      return this.prisma.mccSetting.update({ where: { id: existing.id }, data });
    }
    return this.prisma.mccSetting.create({ data });
  }
}
