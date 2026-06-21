import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Brand Settings ──────────────────────────────────────────────────────

  async getBrandSettings(tenantId: string) {
    const brand = await this.prisma.clientBrandSetting.findUnique({ where: { tenantId } });
    if (!brand) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { companyName: true, email: true } });
      return {
        tenantId,
        companyName: tenant?.companyName ?? null,
        logoUrl: null,
        primaryColor: '#1a56db',
        accentColor: '#7c3aed',
        fontFamily: 'Inter',
        contactEmail: tenant?.email ?? null,
        contactPhone: null,
        websiteUrl: null,
        address: null,
        aboutUsText: null,
        proposalPrefix: null,
      };
    }
    return brand;
  }

  async updateBrandSettings(tenantId: string, body: Record<string, unknown>) {
    const data: Prisma.ClientBrandSettingUpdateInput = {};

    if (body.companyName !== undefined) data.companyName = this.optionalString(body.companyName);
    if (body.logoUrl !== undefined) data.logoUrl = this.optionalString(body.logoUrl);
    if (body.primaryColor !== undefined) data.primaryColor = this.validColor(body.primaryColor);
    if (body.accentColor !== undefined) data.accentColor = this.validColor(body.accentColor);
    if (body.fontFamily !== undefined) data.fontFamily = this.optionalString(body.fontFamily) ?? 'Inter';
    if (body.contactEmail !== undefined) data.contactEmail = this.optionalString(body.contactEmail);
    if (body.contactPhone !== undefined) data.contactPhone = this.optionalString(body.contactPhone);
    if (body.websiteUrl !== undefined) data.websiteUrl = this.optionalString(body.websiteUrl);
    if (body.address !== undefined) data.address = this.optionalString(body.address);
    if (body.aboutUsText !== undefined) data.aboutUsText = this.optionalString(body.aboutUsText);
    if (body.proposalPrefix !== undefined) {
      const prefix = this.optionalString(body.proposalPrefix);
      if (prefix && (prefix.length < 2 || prefix.length > 5)) throw new BadRequestException('Prefix must be 2-5 characters');
      data.proposalPrefix = prefix?.toUpperCase();
    }

    return this.prisma.clientBrandSetting.upsert({
      where: { tenantId },
      update: data,
      create: { tenantId, ...data } as any,
    });
  }

  // ── Service Pricing ─────────────────────────────────────────────────────

  async getServicePricing(tenantId: string) {
    return this.prisma.clientServicePricing.findMany({
      where: { tenantId },
      orderBy: [{ serviceType: 'asc' }, { planName: 'asc' }],
    });
  }

  async updateServicePricing(tenantId: string, body: Record<string, unknown>) {
    const items = body.items;
    if (!Array.isArray(items)) throw new BadRequestException('items array is required');

    const results = [];
    for (const raw of items) {
      const item = raw as Record<string, unknown>;
      const serviceType = this.requiredString(item.serviceType, 'serviceType');
      const planName = this.requiredString(item.planName, 'planName');
      const mccCost = this.requiredNumber(item.mccCost, 'mccCost');
      const sellingPrice = this.requiredNumber(item.sellingPrice, 'sellingPrice');

      if (sellingPrice < mccCost) {
        throw new BadRequestException(`Selling price for ${serviceType} ${planName} cannot be below MCC cost ($${mccCost})`);
      }

      const marginAmount = Math.round((sellingPrice - mccCost) * 100) / 100;
      const marginPercentage = mccCost > 0 ? Math.round(((sellingPrice - mccCost) / mccCost) * 10000) / 100 : 100;

      const result = await this.prisma.clientServicePricing.upsert({
        where: { tenantId_serviceType_planName: { tenantId, serviceType, planName } },
        update: {
          mccCost,
          sellingPrice,
          marginAmount,
          marginPercentage,
          planFeatures: Array.isArray(item.planFeatures) ? item.planFeatures : undefined,
          isActive: typeof item.isActive === 'boolean' ? item.isActive : undefined,
        },
        create: {
          tenantId,
          serviceType,
          planName,
          mccCost,
          sellingPrice,
          marginAmount,
          marginPercentage,
          planFeatures: Array.isArray(item.planFeatures) ? item.planFeatures : [],
          isActive: typeof item.isActive === 'boolean' ? item.isActive : true,
        },
      });
      results.push(result);
    }

    return results;
  }

  private requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${field} is required`);
    return value.trim();
  }

  private requiredNumber(value: unknown, field: string): number {
    const num = Number(value);
    if (!Number.isFinite(num)) throw new BadRequestException(`${field} must be a valid number`);
    return num;
  }

  private optionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private validColor(value: unknown): string {
    const str = typeof value === 'string' ? value.trim() : '';
    if (!/^#[0-9a-fA-F]{6}$/.test(str)) throw new BadRequestException('Invalid color format (expected #RRGGBB)');
    return str;
  }
}
