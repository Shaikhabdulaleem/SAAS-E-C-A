import { JobStatus } from '@prisma/client';
import { JobsService } from './jobs.service';

describe('JobsService required enqueue', () => {
  it('fails loudly when a required job cannot be queued without Redis', async () => {
    const previousRedisUrl = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    const create = jest.fn().mockResolvedValue({ id: 'job-log-1' });
    const update = jest.fn().mockResolvedValue({});
    const service = new JobsService({ jobLog: { create, update } } as any);

    await expect(service.enqueue({
      tenantId: 'tenant-1',
      queue: 'email-campaigns',
      name: 'email.campaign.send_now',
      payload: { campaignId: 'campaign-1' },
      required: true,
    })).rejects.toThrow('Redis is not configured');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'job-log-1' },
      data: expect.objectContaining({ status: JobStatus.failed, lastError: 'Redis is not configured' }),
    });
    process.env.REDIS_URL = previousRedisUrl;
  });
});
