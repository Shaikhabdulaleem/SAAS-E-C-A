import 'reflect-metadata';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient, JobStatus } from '@prisma/client';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('REDIS_URL is required to run workers');
}

const prisma = new PrismaClient();
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

async function processEmailCampaign(data: Record<string, unknown>) {
  const campaignId = data.campaignId as string | undefined;
  if (!campaignId) return { skipped: true, reason: 'no campaignId' };
  const recipients = await prisma.campaignRecipient.findMany({
    where: { campaignId, status: 'queued' },
  });
  return { processed: true, recipientCount: recipients.length };
}

async function processColdSequenceTick(data: Record<string, unknown>) {
  const campaignId = data.campaignId as string | undefined;
  if (!campaignId) return { skipped: true };
  const campaign = await prisma.coldCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== 'active') return { skipped: true, reason: 'campaign not active' };
  const pendingStates = await prisma.coldSequenceState.findMany({
    where: { campaignId, status: 'queued', nextSendAfter: { lte: new Date() } },
    take: 100,
  });
  return { processed: true, pendingCount: pendingStates.length };
}

async function processNotification(data: Record<string, unknown>) {
  const payload = data.payload as Record<string, unknown> | undefined;
  if (!payload) return { skipped: true };
  return { processed: true, type: data.name };
}

async function processDnsCheck(data: Record<string, unknown>) {
  const payload = data.payload as Record<string, unknown> | undefined;
  const domainId = (payload?.domainId ?? '') as string;
  if (!domainId) return { skipped: true };
  const domain = await prisma.sendingDomain.findUnique({ where: { id: domainId } });
  if (!domain) return { skipped: true, reason: 'domain not found' };
  return { processed: true, domain: domain.domain };
}

const handlers: Record<string, (data: Record<string, unknown>) => Promise<Record<string, unknown>>> = {
  'email-campaigns': processEmailCampaign,
  'cold-email-sequences': processColdSequenceTick,
  'notifications': processNotification,
  'dns-checks': processDnsCheck,
};

const queues = [
  'email-campaigns',
  'cold-email-sequences',
  'mailbox-warmup',
  'provider-sync',
  'dns-checks',
  'notifications',
  'external-api',
];

for (const queueName of queues) {
  new Worker(queueName, async (job) => {
    const jobLogId = job.data?.jobLogId as string | undefined;
    if (jobLogId) {
      await prisma.jobLog.update({
        where: { id: jobLogId },
        data: { status: JobStatus.running, attempts: { increment: 1 }, startedAt: new Date() },
      });
    }

    let result: Record<string, unknown> = { processed: true, queueName };
    try {
      const handler = handlers[queueName];
      if (handler) {
        result = await handler(job.data ?? {});
      }

      if (jobLogId) {
        await prisma.jobLog.update({
          where: { id: jobLogId },
          data: { status: JobStatus.completed, completedAt: new Date() },
        });
      }
    } catch (error) {
      if (jobLogId) {
        await prisma.jobLog.update({
          where: { id: jobLogId },
          data: {
            status: JobStatus.failed,
            completedAt: new Date(),
            lastError: error instanceof Error ? error.message : String(error),
          },
        });
      }
      throw error;
    }

    return result;
  }, { connection: connection as never });
}

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  await connection.quit();
  process.exit(0);
});
