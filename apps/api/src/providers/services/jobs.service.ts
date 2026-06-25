import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { Prisma, JobStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JobsService implements OnModuleDestroy {
  private readonly queues = new Map<string, Queue>();
  private readonly connection = process.env.REDIS_URL
    ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
    : null;

  constructor(private readonly prisma: PrismaService) {}

  async enqueue(input: {
    tenantId?: string;
    queue: string;
    name: string;
    payload?: Prisma.InputJsonValue;
    scheduledAt?: Date;
    maxAttempts?: number;
    required?: boolean;
  }) {
    const log = await this.prisma.jobLog.create({
      data: {
        tenantId: input.tenantId,
        queue: input.queue,
        name: input.name,
        payload: input.payload,
        scheduledAt: input.scheduledAt,
        maxAttempts: input.maxAttempts ?? 3,
      },
    });

    if (this.connection) {
      try {
        const queue = this.getQueue(input.queue);
        const delay = input.scheduledAt ? Math.max(0, input.scheduledAt.getTime() - Date.now()) : 0;
        const job = await queue.add(input.name, { jobLogId: log.id, tenantId: input.tenantId, payload: input.payload }, {
          attempts: input.maxAttempts ?? 3,
          delay,
          removeOnComplete: 1000,
          removeOnFail: 1000,
        });
        return this.prisma.jobLog.update({
          where: { id: log.id },
          data: { providerRequestId: job.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (input.required) {
          await this.prisma.jobLog.update({
            where: { id: log.id },
            data: { status: JobStatus.failed, completedAt: new Date(), lastError: message },
          });
          throw error;
        }
        return this.prisma.jobLog.update({
          where: { id: log.id },
          data: { lastError: message },
        });
      }
    } else if (input.required) {
      await this.prisma.jobLog.update({
        where: { id: log.id },
        data: { status: JobStatus.failed, completedAt: new Date(), lastError: 'Redis is not configured' },
      });
      throw new Error('Redis is not configured');
    }

    return log;
  }

  mark(jobLogId: string, status: JobStatus, data: { error?: string; providerRequestId?: string } = {}) {
    return this.prisma.jobLog.update({
      where: { id: jobLogId },
      data: {
        status,
        attempts: status === JobStatus.running ? { increment: 1 } : undefined,
        lastError: data.error,
        providerRequestId: data.providerRequestId,
        startedAt: status === JobStatus.running ? new Date() : undefined,
        completedAt: status === JobStatus.completed || status === JobStatus.failed || status === JobStatus.cancelled ? new Date() : undefined,
      },
    });
  }

  list(tenantId: string | undefined, query: Record<string, string>) {
    return this.prisma.jobLog.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ...(query.status ? { status: query.status as JobStatus } : {}),
        ...(query.queue ? { queue: query.queue } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(Number(query.pageSize ?? 50), 1), 200),
    });
  }

  async onModuleDestroy() {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    await this.connection?.quit();
  }

  private getQueue(name: string) {
    const existing = this.queues.get(name);
    if (existing) return existing;
    if (!this.connection) throw new Error('Redis is not configured');
    const queue = new Queue(name, { connection: this.connection as never });
    this.queues.set(name, queue);
    return queue;
  }
}
