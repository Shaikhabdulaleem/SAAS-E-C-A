import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface LogActivityInput {
  proposalId: string;
  eventType: string;
  actorType: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ProposalActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: LogActivityInput) {
    return this.prisma.proposalActivity.create({
      data: {
        proposalId: input.proposalId,
        eventType: input.eventType,
        actorType: input.actorType,
        actorId: input.actorId,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  async list(proposalId: string) {
    return this.prisma.proposalActivity.findMany({
      where: { proposalId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
