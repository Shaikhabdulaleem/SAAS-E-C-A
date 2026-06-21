import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface BrandConfig {
  companyName: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  address: string | null;
  aboutUsText: string | null;
}

const MCC_BRAND: BrandConfig = {
  companyName: 'NexusHQ',
  logoUrl: null,
  primaryColor: '#1a56db',
  accentColor: '#7c3aed',
  fontFamily: 'Inter',
  contactEmail: 'contact@nexushq.com',
  contactPhone: null,
  websiteUrl: 'https://nexushq.com',
  address: null,
  aboutUsText: 'NexusHQ is a comprehensive SaaS platform providing Email Marketing, Cold Outreach, CRM, AI Call Assistant, and Advanced Analytics solutions.',
};

@Injectable()
export class BrandingService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(createdByType: string, tenantId?: string): Promise<BrandConfig> {
    if (createdByType === 'mcc_admin') {
      return MCC_BRAND;
    }

    if (!tenantId) return MCC_BRAND;

    const brand = await this.prisma.clientBrandSetting.findUnique({ where: { tenantId } });
    if (!brand) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { companyName: true, email: true } });
      return {
        ...MCC_BRAND,
        companyName: tenant?.companyName ?? 'Company',
        contactEmail: tenant?.email ?? null,
      };
    }

    return {
      companyName: brand.companyName ?? 'Company',
      logoUrl: brand.logoUrl,
      primaryColor: brand.primaryColor,
      accentColor: brand.accentColor,
      fontFamily: brand.fontFamily,
      contactEmail: brand.contactEmail,
      contactPhone: brand.contactPhone,
      websiteUrl: brand.websiteUrl,
      address: brand.address,
      aboutUsText: brand.aboutUsText,
    };
  }
}
