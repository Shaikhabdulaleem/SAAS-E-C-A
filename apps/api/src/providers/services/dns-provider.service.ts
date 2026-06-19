import { BadRequestException, Injectable } from '@nestjs/common';
import { promises as dns } from 'dns';
import { DnsProviderType, Prisma } from '@prisma/client';
import { ProviderLogsService } from './provider-logs.service';

export interface DnsRecordInput {
  type: string;
  name: string;
  value: string;
  ttl?: number;
  priority?: number;
}

@Injectable()
export class DnsProviderService {
  constructor(private readonly logs: ProviderLogsService) {}

  async createRecords(input: {
    tenantId: string;
    provider: DnsProviderType;
    domain: string;
    zoneId?: string | null;
    apiKey: string;
    records: DnsRecordInput[];
  }) {
    if (input.provider === DnsProviderType.cloudflare) {
      return this.createCloudflareRecords(input);
    }
    return this.createNamecheapRecords(input);
  }

  async verify(domain: string) {
    const [txt, mx, tracking] = await Promise.allSettled([
      dns.resolveTxt(domain),
      dns.resolveMx(domain),
      dns.resolveCname(`track.${domain}`),
    ]);
    const txtValues = txt.status === 'fulfilled' ? txt.value.flat().join(' ') : '';
    const mxValues = mx.status === 'fulfilled' ? mx.value : [];
    const trackingValues = tracking.status === 'fulfilled' ? tracking.value : [];

    return {
      spfValid: txtValues.includes('v=spf1'),
      dkimValid: txtValues.toLowerCase().includes('dkim'),
      dmarcValid: await this.hasDmarc(domain),
      mxValid: mxValues.length > 0,
      trackingValid: trackingValues.length > 0,
    };
  }

  private async hasDmarc(domain: string) {
    const result = await dns.resolveTxt(`_dmarc.${domain}`).catch(() => []);
    return result.flat().join(' ').includes('v=DMARC1');
  }

  private async createCloudflareRecords(input: {
    tenantId: string;
    domain: string;
    zoneId?: string | null;
    apiKey: string;
    records: DnsRecordInput[];
  }) {
    if (!input.zoneId) throw new BadRequestException('Cloudflare zone id is required');
    const created: Array<{ name: string; id?: string }> = [];
    for (const record of input.records) {
      const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${input.zoneId}/dns_records`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: record.type,
          name: record.name,
          content: record.value,
          ttl: record.ttl ?? 1,
          priority: record.priority,
        }),
      });
      const body = await response.json().catch(() => ({}));
      await this.logs.create({
        tenantId: input.tenantId,
        provider: 'cloudflare',
        operation: 'dns_record_create',
        status: response.ok ? 'success' : 'failed',
        request: record as unknown as Prisma.InputJsonValue,
        response: body,
        error: response.ok ? undefined : JSON.stringify(body),
      });
      if (!response.ok) throw new BadRequestException(`Cloudflare DNS record failed for ${record.name}`);
      created.push({ name: record.name, id: body?.result?.id });
    }
    return created;
  }

  private async createNamecheapRecords(input: {
    tenantId: string;
    domain: string;
    apiKey: string;
    records: DnsRecordInput[];
  }) {
    await this.logs.create({
      tenantId: input.tenantId,
      provider: 'namecheap',
      operation: 'dns_record_create',
      status: 'pending',
      request: { domain: input.domain, records: input.records.map((record) => ({ ...record, value: '[redacted]' })) },
      response: { message: 'Namecheap API credentials require ApiUser, UserName, ClientIp, and domain SLD/TLD mapping.' },
    });
    throw new BadRequestException('Namecheap DNS automation requires full Namecheap account API metadata');
  }
}
