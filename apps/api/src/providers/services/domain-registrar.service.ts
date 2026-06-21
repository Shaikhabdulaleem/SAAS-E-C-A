import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../tenants/encryption.service';
import { ProviderLogsService } from './provider-logs.service';

export interface AvailabilityResult {
  domain: string;
  available: boolean;
  price: number | null;
  currency: string;
  isPremium: boolean;
}

export interface PurchaseResult {
  success: boolean;
  domain: string;
  orderId?: string;
  transactionId?: string;
  error?: string;
}

interface RegistrarCredentials {
  provider: string;
  raw: Record<string, string>;
}

const SUPPORTED_REGISTRARS = ['namecheap', 'porkbun', 'dynadot', 'godaddy'];

@Injectable()
export class DomainRegistrarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly logs: ProviderLogsService,
  ) {}

  async getRegistrarCredentials(tenantId: string, provider: string): Promise<RegistrarCredentials> {
    if (!SUPPORTED_REGISTRARS.includes(provider)) throw new BadRequestException(`Unsupported registrar: ${provider}`);
    const integration = await this.prisma.tenantIntegration.findFirst({
      where: { tenantId, platformKey: provider, isActive: true },
    });
    if (!integration) throw new BadRequestException(`${provider} is not connected. Go to Settings > Integrations.`);
    const decrypted = this.encryption.decrypt(integration.apiKeyCipher);
    try {
      return { provider, raw: JSON.parse(decrypted) };
    } catch {
      return { provider, raw: { apiKey: decrypted } };
    }
  }

  async listConnectedRegistrars(tenantId: string) {
    const integrations = await this.prisma.tenantIntegration.findMany({
      where: { tenantId, platformKey: { in: SUPPORTED_REGISTRARS }, isActive: true },
    });
    return integrations.map((i) => ({ provider: i.platformKey, connectedAt: i.createdAt }));
  }

  // ── Unified Interface ─────────────────────────────────────────────

  async checkAvailability(tenantId: string, provider: string, domains: string[]): Promise<AvailabilityResult[]> {
    const creds = await this.getRegistrarCredentials(tenantId, provider);
    switch (provider) {
      case 'namecheap': return this.namecheapCheck(tenantId, creds.raw, domains);
      case 'porkbun': return this.porkbunCheck(tenantId, creds.raw, domains);
      case 'dynadot': return this.dynadotCheck(tenantId, creds.raw, domains);
      case 'godaddy': return this.godaddyCheck(tenantId, creds.raw, domains);
      default: throw new BadRequestException(`Unsupported registrar: ${provider}`);
    }
  }

  async purchaseDomain(tenantId: string, provider: string, domain: string, years = 1): Promise<PurchaseResult> {
    const creds = await this.getRegistrarCredentials(tenantId, provider);
    switch (provider) {
      case 'namecheap': return this.namecheapPurchase(tenantId, creds.raw, domain, years);
      case 'porkbun': return this.porkbunPurchase(tenantId, creds.raw, domain, years);
      case 'dynadot': return this.dynadotPurchase(tenantId, creds.raw, domain, years);
      case 'godaddy': return this.godaddyPurchase(tenantId, creds.raw, domain, years);
      default: throw new BadRequestException(`Unsupported registrar: ${provider}`);
    }
  }

  async setNameservers(tenantId: string, provider: string, domain: string, nameservers: string[]): Promise<void> {
    const creds = await this.getRegistrarCredentials(tenantId, provider);
    switch (provider) {
      case 'namecheap': return this.namecheapSetNs(tenantId, creds.raw, domain, nameservers);
      case 'porkbun': return this.porkbunSetNs(tenantId, creds.raw, domain, nameservers);
      case 'dynadot': return this.dynadotSetNs(tenantId, creds.raw, domain, nameservers);
      case 'godaddy': return this.godaddySetNs(tenantId, creds.raw, domain, nameservers);
      default: throw new BadRequestException(`Unsupported registrar: ${provider}`);
    }
  }

  // ── Namecheap ─────────────────────────────────────────────────────

  private async namecheapCall(creds: Record<string, string>, command: string, params: Record<string, string> = {}) {
    const qs = new URLSearchParams({
      ApiUser: creds.apiUser ?? creds.userName ?? '',
      ApiKey: creds.apiKey ?? '',
      UserName: creds.userName ?? creds.apiUser ?? '',
      ClientIp: creds.clientIp ?? '0.0.0.0',
      Command: command,
      ...params,
    });
    const response = await fetch(`https://api.namecheap.com/xml.response?${qs.toString()}`);
    const text = await response.text();
    return text;
  }

  private async namecheapCheck(tenantId: string, creds: Record<string, string>, domains: string[]): Promise<AvailabilityResult[]> {
    const results: AvailabilityResult[] = [];
    for (let i = 0; i < domains.length; i += 50) {
      const batch = domains.slice(i, i + 50);
      const xml = await this.namecheapCall(creds, 'namecheap.domains.check', { DomainList: batch.join(',') });
      await this.logs.create({ tenantId, provider: 'namecheap', operation: 'domains.check', status: 'success', request: { domains: batch }, response: { xml: xml.substring(0, 500) } });
      const domainRegex = /<DomainCheckResult\s+Domain="([^"]+)"\s+Available="([^"]+)"(?:\s+IsPremiumName="([^"]+)")?(?:\s+PremiumRegistrationPrice="([^"]+)")?/g;
      let match: RegExpExecArray | null;
      while ((match = domainRegex.exec(xml)) !== null) {
        results.push({
          domain: match[1],
          available: match[2] === 'true',
          price: match[4] ? parseFloat(match[4]) : this.estimatePrice(match[1]),
          currency: 'USD',
          isPremium: match[3] === 'true',
        });
      }
    }
    return results;
  }

  private async namecheapPurchase(tenantId: string, creds: Record<string, string>, domain: string, years: number): Promise<PurchaseResult> {
    const [sld, ...tldParts] = domain.split('.');
    const tld = tldParts.join('.');
    try {
      const xml = await this.namecheapCall(creds, 'namecheap.domains.create', {
        DomainName: domain, Years: String(years),
        RegistrantFirstName: 'Domain', RegistrantLastName: 'Admin',
        RegistrantAddress1: '123 Main St', RegistrantCity: 'New York',
        RegistrantStateProvince: 'NY', RegistrantPostalCode: '10001',
        RegistrantCountry: 'US', RegistrantPhone: '+1.5555555555',
        RegistrantEmailAddress: creds.apiUser ? `${creds.apiUser}@users.noreply.com` : 'admin@domain.com',
        TechFirstName: 'Domain', TechLastName: 'Admin',
        TechAddress1: '123 Main St', TechCity: 'New York',
        TechStateProvince: 'NY', TechPostalCode: '10001',
        TechCountry: 'US', TechPhone: '+1.5555555555',
        TechEmailAddress: creds.apiUser ? `${creds.apiUser}@users.noreply.com` : 'admin@domain.com',
        AdminFirstName: 'Domain', AdminLastName: 'Admin',
        AdminAddress1: '123 Main St', AdminCity: 'New York',
        AdminStateProvince: 'NY', AdminPostalCode: '10001',
        AdminCountry: 'US', AdminPhone: '+1.5555555555',
        AdminEmailAddress: creds.apiUser ? `${creds.apiUser}@users.noreply.com` : 'admin@domain.com',
        AuxBillingFirstName: 'Domain', AuxBillingLastName: 'Admin',
        AuxBillingAddress1: '123 Main St', AuxBillingCity: 'New York',
        AuxBillingStateProvince: 'NY', AuxBillingPostalCode: '10001',
        AuxBillingCountry: 'US', AuxBillingPhone: '+1.5555555555',
        AuxBillingEmailAddress: creds.apiUser ? `${creds.apiUser}@users.noreply.com` : 'admin@domain.com',
        AddFreeWhoisguard: 'yes', WGEnabled: 'yes',
      });
      await this.logs.create({ tenantId, provider: 'namecheap', operation: 'domains.create', status: 'success', request: { domain, years }, response: { xml: xml.substring(0, 500) } });
      const success = xml.includes('Registered="true"') || xml.includes('Status="OK"');
      const orderIdMatch = xml.match(/OrderId="(\d+)"/);
      return { success, domain, orderId: orderIdMatch?.[1], transactionId: orderIdMatch?.[1] };
    } catch (error) {
      await this.logs.create({ tenantId, provider: 'namecheap', operation: 'domains.create', status: 'failed', request: { domain }, error: error instanceof Error ? error.message : String(error) });
      return { success: false, domain, error: error instanceof Error ? error.message : 'Purchase failed' };
    }
  }

  private async namecheapSetNs(tenantId: string, creds: Record<string, string>, domain: string, nameservers: string[]): Promise<void> {
    const [sld, ...tldParts] = domain.split('.');
    const tld = tldParts.join('.');
    const xml = await this.namecheapCall(creds, 'namecheap.domains.dns.setCustom', { SLD: sld, TLD: tld, Nameservers: nameservers.join(',') });
    await this.logs.create({ tenantId, provider: 'namecheap', operation: 'domains.dns.setCustom', status: xml.includes('true') ? 'success' : 'failed', request: { domain, nameservers }, response: { xml: xml.substring(0, 500) } });
  }

  // ── Porkbun ───────────────────────────────────────────────────────

  private async porkbunCheck(tenantId: string, creds: Record<string, string>, domains: string[]): Promise<AvailabilityResult[]> {
    const results: AvailabilityResult[] = [];
    for (const domain of domains) {
      try {
        const response = await fetch(`https://api.porkbun.com/api/json/v3/domain/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apikey: creds.apikey, secretapikey: creds.secretapikey, domain }),
        });
        const data = await response.json();
        results.push({
          domain,
          available: data.status === 'SUCCESS' && data.available === true,
          price: data.pricing?.registration ? parseFloat(data.pricing.registration) : this.estimatePrice(domain),
          currency: 'USD',
          isPremium: data.premium === true,
        });
      } catch {
        results.push({ domain, available: false, price: null, currency: 'USD', isPremium: false });
      }
    }
    await this.logs.create({ tenantId, provider: 'porkbun', operation: 'domain.check', status: 'success', request: { count: domains.length } });
    return results;
  }

  private async porkbunPurchase(tenantId: string, creds: Record<string, string>, domain: string, years: number): Promise<PurchaseResult> {
    try {
      const response = await fetch(`https://api.porkbun.com/api/json/v3/domain/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apikey: creds.apikey, secretapikey: creds.secretapikey, domain, years: String(years) }),
      });
      const data = await response.json();
      await this.logs.create({ tenantId, provider: 'porkbun', operation: 'domain.register', status: data.status === 'SUCCESS' ? 'success' : 'failed', request: { domain }, response: data });
      return { success: data.status === 'SUCCESS', domain, orderId: data.orderId };
    } catch (error) {
      return { success: false, domain, error: error instanceof Error ? error.message : 'Purchase failed' };
    }
  }

  private async porkbunSetNs(tenantId: string, creds: Record<string, string>, domain: string, nameservers: string[]): Promise<void> {
    await fetch(`https://api.porkbun.com/api/json/v3/domain/updateNs/${domain}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apikey: creds.apikey, secretapikey: creds.secretapikey, ns: nameservers }),
    });
    await this.logs.create({ tenantId, provider: 'porkbun', operation: 'domain.updateNs', status: 'success', request: { domain, nameservers } });
  }

  // ── Dynadot ───────────────────────────────────────────────────────

  private async dynadotCheck(tenantId: string, creds: Record<string, string>, domains: string[]): Promise<AvailabilityResult[]> {
    const results: AvailabilityResult[] = [];
    for (let i = 0; i < domains.length; i++) {
      try {
        const response = await fetch(`https://api.dynadot.com/api3.json?key=${encodeURIComponent(creds.apiKey)}&command=search&domain0=${encodeURIComponent(domains[i])}`);
        const data = await response.json();
        const searchResult = data?.SearchResponse?.SearchResults?.[0] ?? {};
        results.push({
          domain: domains[i],
          available: searchResult.Available === 'yes',
          price: searchResult.Price ? parseFloat(searchResult.Price) : this.estimatePrice(domains[i]),
          currency: 'USD',
          isPremium: false,
        });
      } catch {
        results.push({ domain: domains[i], available: false, price: null, currency: 'USD', isPremium: false });
      }
    }
    await this.logs.create({ tenantId, provider: 'dynadot', operation: 'search', status: 'success', request: { count: domains.length } });
    return results;
  }

  private async dynadotPurchase(tenantId: string, creds: Record<string, string>, domain: string, years: number): Promise<PurchaseResult> {
    try {
      const response = await fetch(`https://api.dynadot.com/api3.json?key=${encodeURIComponent(creds.apiKey)}&command=register&domain=${encodeURIComponent(domain)}&duration=${years}`);
      const data = await response.json();
      const success = data?.RegisterResponse?.Status === 'success';
      await this.logs.create({ tenantId, provider: 'dynadot', operation: 'register', status: success ? 'success' : 'failed', request: { domain }, response: data });
      return { success, domain };
    } catch (error) {
      return { success: false, domain, error: error instanceof Error ? error.message : 'Purchase failed' };
    }
  }

  private async dynadotSetNs(tenantId: string, creds: Record<string, string>, domain: string, nameservers: string[]): Promise<void> {
    const nsParams = nameservers.map((ns, i) => `ns${i}=${encodeURIComponent(ns)}`).join('&');
    await fetch(`https://api.dynadot.com/api3.json?key=${encodeURIComponent(creds.apiKey)}&command=set_ns&domain=${encodeURIComponent(domain)}&${nsParams}`);
    await this.logs.create({ tenantId, provider: 'dynadot', operation: 'set_ns', status: 'success', request: { domain, nameservers } });
  }

  // ── GoDaddy ───────────────────────────────────────────────────────

  private godaddyHeaders(creds: Record<string, string>): Record<string, string> {
    return {
      Authorization: `sso-key ${creds.key}:${creds.secret}`,
      'Content-Type': 'application/json',
    };
  }

  private async godaddyCheck(tenantId: string, creds: Record<string, string>, domains: string[]): Promise<AvailabilityResult[]> {
    const results: AvailabilityResult[] = [];
    for (const domain of domains) {
      try {
        const response = await fetch(`https://api.godaddy.com/v1/domains/available?domain=${encodeURIComponent(domain)}`, {
          headers: this.godaddyHeaders(creds),
        });
        const data = await response.json();
        results.push({
          domain,
          available: data.available === true,
          price: data.price ? data.price / 1000000 : this.estimatePrice(domain),
          currency: data.currency ?? 'USD',
          isPremium: data.definitive === false,
        });
      } catch {
        results.push({ domain, available: false, price: null, currency: 'USD', isPremium: false });
      }
    }
    await this.logs.create({ tenantId, provider: 'godaddy', operation: 'domains.available', status: 'success', request: { count: domains.length } });
    return results;
  }

  private async godaddyPurchase(tenantId: string, creds: Record<string, string>, domain: string, years: number): Promise<PurchaseResult> {
    try {
      const response = await fetch(`https://api.godaddy.com/v1/domains/purchase`, {
        method: 'POST',
        headers: this.godaddyHeaders(creds),
        body: JSON.stringify({
          domain, consent: { agreedAt: new Date().toISOString(), agreedBy: creds.clientIp ?? '0.0.0.0', agreementKeys: ['DNRA'] },
          period: years, privacy: true, renewAuto: false,
          contactAdmin: { firstName: 'Domain', lastName: 'Admin', email: 'admin@domain.com', phone: '+1.5555555555', addressMailing: { address1: '123 Main St', city: 'New York', state: 'NY', postalCode: '10001', country: 'US' } },
          contactRegistrant: { firstName: 'Domain', lastName: 'Admin', email: 'admin@domain.com', phone: '+1.5555555555', addressMailing: { address1: '123 Main St', city: 'New York', state: 'NY', postalCode: '10001', country: 'US' } },
          contactTech: { firstName: 'Domain', lastName: 'Admin', email: 'admin@domain.com', phone: '+1.5555555555', addressMailing: { address1: '123 Main St', city: 'New York', state: 'NY', postalCode: '10001', country: 'US' } },
        }),
      });
      const data = await response.json();
      await this.logs.create({ tenantId, provider: 'godaddy', operation: 'domains.purchase', status: response.ok ? 'success' : 'failed', request: { domain }, response: data });
      return { success: response.ok, domain, orderId: data.orderId?.toString() };
    } catch (error) {
      return { success: false, domain, error: error instanceof Error ? error.message : 'Purchase failed' };
    }
  }

  private async godaddySetNs(tenantId: string, creds: Record<string, string>, domain: string, nameservers: string[]): Promise<void> {
    await fetch(`https://api.godaddy.com/v1/domains/${encodeURIComponent(domain)}`, {
      method: 'PATCH',
      headers: this.godaddyHeaders(creds),
      body: JSON.stringify({ nameServers: nameservers }),
    });
    await this.logs.create({ tenantId, provider: 'godaddy', operation: 'domains.updateNs', status: 'success', request: { domain, nameservers } });
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private estimatePrice(domain: string): number {
    const tld = domain.split('.').slice(1).join('.');
    const prices: Record<string, number> = { com: 10.98, io: 32.98, co: 11.98, net: 12.98, org: 9.98 };
    return prices[tld] ?? 12.98;
  }
}
