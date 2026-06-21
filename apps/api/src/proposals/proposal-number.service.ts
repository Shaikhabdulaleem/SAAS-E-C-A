import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProposalNumberService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(scope: 'mcc' | 'client', tenantId?: string, prefix?: string): Promise<string> {
    const year = new Date().getFullYear();

    if (scope === 'mcc') {
      return this.nextNumber('MCC', year, { scope: 'mcc' });
    }

    const resolvedPrefix = prefix || 'CLT';
    return this.nextNumber(resolvedPrefix, year, { scope: 'client', tenantId });
  }

  async resolvePrefix(tenantId: string): Promise<string> {
    const brand = await this.prisma.clientBrandSetting.findUnique({ where: { tenantId } });
    if (brand?.proposalPrefix) return brand.proposalPrefix;

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { companyName: true } });
    if (!tenant) return 'CLT';

    return tenant.companyName
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0].toUpperCase())
      .join('')
      .slice(0, 4) || 'CLT';
  }

  private async nextNumber(prefix: string, year: number, where: Record<string, string | undefined>): Promise<string> {
    const pattern = `${prefix}-${year}-%`;
    const last = await this.prisma.proposal.findFirst({
      where: { ...where, proposalNumber: { startsWith: `${prefix}-${year}-` } },
      orderBy: { proposalNumber: 'desc' },
      select: { proposalNumber: true },
    });

    let seq = 1;
    if (last?.proposalNumber) {
      const parts = last.proposalNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
  }
}
