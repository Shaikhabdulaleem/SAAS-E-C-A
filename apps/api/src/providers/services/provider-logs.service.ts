import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProviderLogsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: {
    tenantId?: string;
    provider: string;
    operation: string;
    status?: 'success' | 'failed' | 'pending';
    requestId?: string;
    request?: Prisma.InputJsonValue;
    response?: Prisma.InputJsonValue;
    error?: string;
  }) {
    return this.prisma.providerLog.create({
      data: {
        tenantId: input.tenantId,
        provider: input.provider,
        operation: input.operation,
        status: input.status ?? 'pending',
        requestId: input.requestId,
        request: input.request,
        response: input.response,
        error: input.error,
      },
    });
  }
}
