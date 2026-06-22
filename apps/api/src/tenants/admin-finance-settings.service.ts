import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminFinanceSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTaxDefaults() {
    return this.prisma.financeTaxConfig.findMany({
      where: { scope: 'mcc' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsertTaxDefault(data: {
    id?: string;
    name: string;
    rate: number;
    type?: string;
    appliesTo?: string;
    region?: string;
    isDefault?: boolean;
    isActive?: boolean;
  }) {
    if (data.id) {
      return this.prisma.financeTaxConfig.update({
        where: { id: data.id },
        data: {
          name: data.name,
          rate: data.rate,
          type: data.type,
          appliesTo: data.appliesTo,
          region: data.region,
          isDefault: data.isDefault,
          isActive: data.isActive,
        },
      });
    }
    return this.prisma.financeTaxConfig.create({
      data: {
        scope: 'mcc',
        name: data.name,
        rate: data.rate,
        type: data.type ?? 'percentage',
        appliesTo: data.appliesTo ?? 'all',
        region: data.region,
        isDefault: data.isDefault ?? false,
        isActive: data.isActive ?? true,
      },
    });
  }

  async getFinanceSettings() {
    const existing = await this.prisma.financeSetting.findFirst({ where: { scope: 'mcc' } });
    if (existing) return existing;
    return this.prisma.financeSetting.create({ data: { scope: 'mcc' } });
  }

  async updateFinanceSettings(data: Record<string, unknown>) {
    const existing = await this.prisma.financeSetting.findFirst({ where: { scope: 'mcc' } });
    if (existing) {
      return this.prisma.financeSetting.update({
        where: { id: existing.id },
        data: {
          invoicePrefix: data.invoicePrefix ? String(data.invoicePrefix) : undefined,
          creditNotePrefix: data.creditNotePrefix ? String(data.creditNotePrefix) : undefined,
          defaultPaymentTerms: data.defaultPaymentTerms ? String(data.defaultPaymentTerms) : undefined,
          defaultCurrency: data.defaultCurrency ? String(data.defaultCurrency) : undefined,
          invoiceFooterText: data.invoiceFooterText ? String(data.invoiceFooterText) : undefined,
          autoSendInvoices: data.autoSendInvoices !== undefined ? Boolean(data.autoSendInvoices) : undefined,
          autoGenerateFromSubscription: data.autoGenerateFromSubscription !== undefined ? Boolean(data.autoGenerateFromSubscription) : undefined,
        },
      });
    }
    return this.prisma.financeSetting.create({ data: { scope: 'mcc' } });
  }
}
