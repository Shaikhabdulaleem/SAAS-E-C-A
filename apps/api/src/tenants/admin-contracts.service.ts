import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: Record<string, string>) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 20), 1), 100);
    const where: Prisma.TenantContractWhereInput = {};
    if (query.status && query.status !== 'all') where.status = query.status;
    if (query.tenantId) where.tenantId = query.tenantId;

    const [items, total] = await Promise.all([
      this.prisma.tenantContract.findMany({
        where,
        include: { tenant: { select: { companyName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.tenantContract.count({ where }),
    ]);

    return { items, pagination: { page, pageSize, total } };
  }

  async create(data: Record<string, unknown>, actorUserId: string) {
    const contract = await this.prisma.tenantContract.create({
      data: {
        tenantId: String(data.tenantId),
        title: String(data.title),
        contractType: String(data.contractType ?? 'subscription'),
        status: String(data.status ?? 'draft'),
        startDate: new Date(String(data.startDate)),
        endDate: data.endDate ? new Date(String(data.endDate)) : null,
        renewalDate: data.renewalDate ? new Date(String(data.renewalDate)) : null,
        autoRenew: Boolean(data.autoRenew ?? false),
        value: Number(data.value ?? 0),
        terms: data.terms ? String(data.terms) : null,
        documentUrl: data.documentUrl ? String(data.documentUrl) : null,
        notes: data.notes ? String(data.notes) : null,
        createdBy: actorUserId,
      },
    });

    await this.prisma.auditLog.create({
      data: { actorUserId, tenantId: contract.tenantId, event: 'tenant.contract.created', metadata: { contractId: contract.id } as Prisma.InputJsonValue },
    });

    return contract;
  }

  async update(id: string, data: Record<string, unknown>, actorUserId: string) {
    const contract = await this.prisma.tenantContract.findUnique({ where: { id } });
    if (!contract) throw new NotFoundException('Contract not found');

    const updated = await this.prisma.tenantContract.update({
      where: { id },
      data: {
        title: data.title ? String(data.title) : undefined,
        contractType: data.contractType ? String(data.contractType) : undefined,
        status: data.status ? String(data.status) : undefined,
        endDate: data.endDate ? new Date(String(data.endDate)) : undefined,
        renewalDate: data.renewalDate ? new Date(String(data.renewalDate)) : undefined,
        autoRenew: data.autoRenew !== undefined ? Boolean(data.autoRenew) : undefined,
        value: data.value !== undefined ? Number(data.value) : undefined,
        terms: data.terms !== undefined ? String(data.terms) : undefined,
        documentUrl: data.documentUrl !== undefined ? String(data.documentUrl) : undefined,
        notes: data.notes !== undefined ? String(data.notes) : undefined,
      },
    });

    await this.prisma.auditLog.create({
      data: { actorUserId, tenantId: contract.tenantId, event: 'tenant.contract.updated', metadata: { contractId: id } as Prisma.InputJsonValue },
    });

    return updated;
  }

  async remove(id: string, actorUserId: string) {
    const contract = await this.prisma.tenantContract.findUnique({ where: { id } });
    if (!contract) throw new NotFoundException('Contract not found');
    await this.prisma.tenantContract.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: { actorUserId, tenantId: contract.tenantId, event: 'tenant.contract.deleted', metadata: { contractId: id } as Prisma.InputJsonValue },
    });
    return { success: true };
  }

  async getExpiring() {
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return this.prisma.tenantContract.findMany({
      where: {
        status: 'active',
        OR: [
          { endDate: { lte: thirtyDaysFromNow } },
          { renewalDate: { lte: thirtyDaysFromNow } },
        ],
      },
      include: { tenant: { select: { companyName: true } } },
      orderBy: { endDate: 'asc' },
    });
  }

  async getTenantContracts(tenantId: string) {
    return this.prisma.tenantContract.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
