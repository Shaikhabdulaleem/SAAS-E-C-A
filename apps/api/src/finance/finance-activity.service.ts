import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FinanceActivityService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: {
    invoiceId: string;
    eventType: string;
    actorType: string;
    actorId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.financeInvoiceActivity.create({
      data: {
        invoiceId: input.invoiceId,
        eventType: input.eventType,
        actorType: input.actorType,
        actorId: input.actorId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  list(invoiceId: string) {
    return this.prisma.financeInvoiceActivity.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
