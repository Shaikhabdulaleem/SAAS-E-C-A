import { BadRequestException } from '@nestjs/common';
import { DnsRecordStatus } from '@prisma/client';
import { EmailService } from './email.service';

function serviceWith(prisma: any) {
  return new EmailService(
    prisma,
    { send: jest.fn() } as any,
    { enqueue: jest.fn() } as any,
    { requiredRecords: jest.fn(() => []), verify: jest.fn() } as any,
  );
}

describe('EmailService campaign stabilization', () => {
  const basePayload = {
    name: 'Launch',
    subject: 'Hello',
    fromName: 'NexusHQ',
    fromEmail: 'news@example.com',
    body: '<p>Hello <a href="https://example.com">there</a></p>',
    bodyPlainText: 'Hello there',
    companyAddress: '123 Main St',
    gdprConsent: true,
    recipientFilter: { mode: 'all' },
  };

  it('always creates campaigns as draft through createCampaign', async () => {
    const create = jest.fn(({ data }) => Promise.resolve(data));
    const service = serviceWith({ emailCampaign: { create } });

    const result = await service.createCampaign('tenant-1', 'user-1', { ...basePayload, status: 'scheduled' });

    expect(result.status).toBe('draft');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'draft' }),
    }));
  });

  it('preflight returns backend audience, suppression, and domain readiness', async () => {
    const service = serviceWith({
      contact: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'c1', email: 'a@example.com', firstName: 'A', lastName: 'One' },
          { id: 'c2', email: 'b@example.com', firstName: 'B', lastName: 'Two' },
        ]),
      },
      suppressionEntry: {
        findMany: jest.fn().mockResolvedValue([{ email: 'b@example.com' }]),
      },
      sendingDomain: {
        findFirst: jest.fn().mockResolvedValue({
          domain: 'example.com',
          spfStatus: DnsRecordStatus.verified,
          dkimStatus: DnsRecordStatus.verified,
          dmarcStatus: DnsRecordStatus.verified,
          mxStatus: DnsRecordStatus.verified,
        }),
      },
      emailCampaign: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    });

    const result = await service.preflightCampaign('tenant-1', basePayload);

    expect(result.audience).toMatchObject({ total: 2, suppressed: 1, allowed: 1 });
    expect(result.ready).toBe(true);
    expect(result.warnings).toContain('Suppressed contacts excluded');
  });

  it('create-and-schedule rejects before creating when preflight is not ready', async () => {
    const previousRedisUrl = process.env.REDIS_URL;
    process.env.REDIS_URL = 'redis://localhost:6379';
    const create = jest.fn();
    const service = serviceWith({
      contact: { findMany: jest.fn().mockResolvedValue([]) },
      suppressionEntry: { findMany: jest.fn().mockResolvedValue([]) },
      sendingDomain: { findFirst: jest.fn().mockResolvedValue(null) },
      emailCampaign: { create, findFirst: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.createAndScheduleCampaign('tenant-1', 'user-1', {
      ...basePayload,
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
    process.env.REDIS_URL = previousRedisUrl;
  });

  it('escapes recipient CSV values and neutralizes spreadsheet formulas', async () => {
    const service = serviceWith({
      emailCampaign: {
        findFirst: jest.fn().mockResolvedValue({ id: 'campaign-1', tenantId: 'tenant-1', name: 'Launch' }),
      },
      campaignRecipient: {
        findMany: jest.fn().mockResolvedValue([
          {
            email: '=cmd@example.com',
            firstName: 'A,lice',
            lastName: '"Quoted"',
            status: 'sent',
            sentAt: null,
            openedAt: null,
            clickedAt: null,
            bouncedAt: null,
            variantId: null,
          },
        ]),
      },
    });

    const result = await service.exportRecipientsCsv('tenant-1', 'campaign-1');

    expect(result.csv).toContain('"\'=cmd@example.com","A,lice","""Quoted"""');
  });

  it('rejects tracked click redirects that were not rendered into the email', async () => {
    const service = serviceWith({
      trackingEvent: {
        findFirst: jest.fn()
          .mockResolvedValueOnce({ token: 'token-1', campaignId: 'campaign-1', tenantId: 'tenant-1', recipientId: 'recipient-1', email: 'a@example.com' })
          .mockResolvedValueOnce(null),
      },
    });

    await expect(service.trackEvent('click', 'token-1', { url: 'https://evil.example.com' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
