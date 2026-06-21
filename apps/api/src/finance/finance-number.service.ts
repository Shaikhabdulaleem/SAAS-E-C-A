import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FinanceNumberService {
  constructor(private readonly prisma: PrismaService) {}

  async next(input: { scope: string; tenantId?: string; type: 'invoice' | 'credit_note'; prefix?: string }) {
    const year = new Date().getFullYear();
    const prefix = input.prefix ?? await this.resolvePrefix(input.scope, input.tenantId, input.type);

    const sequence = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.financeSequence.findFirst({
        where: {
          scope: input.scope,
          tenantId: input.tenantId ?? null,
          sequenceType: input.type,
          year,
        },
      });

      if (existing) {
        return tx.financeSequence.update({
          where: { id: existing.id },
          data: { lastSequence: { increment: 1 } },
        });
      }

      return tx.financeSequence.create({
        data: {
          scope: input.scope,
          tenantId: input.tenantId,
          sequenceType: input.type,
          year,
          lastSequence: 1,
        },
      });
    });

    return `${prefix}-${year}-${String(sequence.lastSequence).padStart(4, '0')}`;
  }

  async settings(scope: string, tenantId?: string) {
    const existing = await this.prisma.financeSetting.findFirst({
      where: scope === 'mcc' ? { scope: 'mcc', tenantId: null } : { scope: 'client', tenantId },
    });
    if (existing) return existing;

    const tenant = tenantId ? await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { companyName: true } }) : null;
    const shortName = this.shortName(tenant?.companyName ?? 'Client');
    return this.prisma.financeSetting.create({
      data: {
        scope,
        tenantId,
        invoicePrefix: scope === 'mcc' ? 'MCC-INV' : `${shortName}-INV`,
        creditNotePrefix: scope === 'mcc' ? 'MCC-CN' : `${shortName}-CN`,
      },
    });
  }

  private async resolvePrefix(scope: string, tenantId: string | undefined, type: 'invoice' | 'credit_note') {
    const settings = await this.settings(scope, tenantId);
    return type === 'invoice' ? settings.invoicePrefix : settings.creditNotePrefix;
  }

  private shortName(name: string) {
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((part) => part[0]?.toUpperCase())
      .join('');
    return initials || 'CL';
  }
}
