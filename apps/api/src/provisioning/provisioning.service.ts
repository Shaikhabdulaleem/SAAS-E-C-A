import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DnsRecordStatus,
  DnsProviderType,
  EmailFormat,
  EmailProviderType,
  MailboxProvider,
  MailboxStatus,
  Prisma,
  WarmupStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DnsProviderService } from '../providers/services/dns-provider.service';
import { MailboxProvisioningService } from '../providers/services/mailbox-provisioning.service';
import { DomainRegistrarService } from '../providers/services/domain-registrar.service';
import { JobsService } from '../providers/services/jobs.service';
import { EncryptionService } from '../tenants/encryption.service';

@Injectable()
export class ProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly mailboxProvisioning: MailboxProvisioningService,
    private readonly dnsProvider: DnsProviderService,
    private readonly domainRegistrar: DomainRegistrarService,
    private readonly jobs: JobsService,
  ) {}

  private readonly firstNames: string[] = [
    'James', 'John', 'Robert', 'Michael', 'David', 'William', 'Richard', 'Joseph', 'Thomas', 'Christopher',
    'Charles', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Steven', 'Andrew', 'Paul', 'Joshua', 'Kenneth',
    'Kevin', 'Brian', 'George', 'Timothy', 'Ronald', 'Edward', 'Jason', 'Jeffrey', 'Ryan', 'Jacob',
    'Nicholas', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon', 'Benjamin', 'Samuel', 'Patrick',
    'Alexander', 'Frank', 'Raymond', 'Gregory', 'Jack', 'Dennis', 'Nathan', 'Peter', 'Zachary', 'Tyler',
    'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen',
    'Lisa', 'Nancy', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Dorothy', 'Kimberly', 'Emily', 'Donna',
    'Michelle', 'Carol', 'Amanda', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Sharon', 'Laura', 'Cynthia',
    'Kathleen', 'Amy', 'Angela', 'Shirley', 'Anna', 'Brenda', 'Pamela', 'Emma', 'Nicole', 'Helen',
    'Samantha', 'Katherine', 'Christine', 'Debra', 'Rachel', 'Carolyn', 'Janet', 'Catherine', 'Maria', 'Heather',
  ];

  private readonly lastNames: string[] = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
    'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
    'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
    'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
    'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
    'Phillips', 'Evans', 'Turner', 'Parker', 'Collins', 'Edwards', 'Stewart', 'Morris', 'Murphy', 'Cook',
    'Rogers', 'Morgan', 'Peterson', 'Cooper', 'Reed', 'Bailey', 'Bell', 'Gomez', 'Kelly', 'Howard',
    'Ward', 'Cox', 'Diaz', 'Richardson', 'Wood', 'Watson', 'Brooks', 'Bennett', 'Gray', 'James',
    'Reyes', 'Cruz', 'Hughes', 'Price', 'Myers', 'Long', 'Foster', 'Sanders', 'Ross', 'Morales',
    'Powell', 'Sullivan', 'Russell', 'Ortiz', 'Jenkins', 'Gutierrez', 'Perry', 'Butler', 'Barnes', 'Fisher',
  ];

  // ═══════════════════════════════════════════════════════════════════
  // 1. EMAIL PROVIDER CREDENTIALS
  // ═══════════════════════════════════════════════════════════════════

  async connectProvider(tenantId: string, body: Record<string, unknown>) {
    const providerType = this.requiredEnum<EmailProviderType>(
      body.providerType,
      Object.values(EmailProviderType) as EmailProviderType[],
      'providerType',
    );

    const existing = await this.prisma.emailProviderCredential.findUnique({
      where: { tenantId_providerType: { tenantId, providerType } },
    });
    if (existing) throw new BadRequestException(`${providerType} is already connected. Disconnect first.`);

    let data: Prisma.EmailProviderCredentialUncheckedCreateInput = { tenantId, providerType };

    if (providerType === EmailProviderType.google_workspace) {
      const adminEmail = this.requiredString(body.adminEmail, 'adminEmail');
      const serviceAccountJson = this.requiredString(body.serviceAccountJson, 'serviceAccountJson');
      try {
        JSON.parse(serviceAccountJson);
      } catch {
        throw new BadRequestException('serviceAccountJson must be valid JSON');
      }
      data = {
        ...data,
        adminEmailCipher: this.encryption.encrypt(adminEmail),
        serviceAccountCipher: this.encryption.encrypt(serviceAccountJson),
      };
    } else {
      const msTenantId = this.requiredString(body.msTenantId, 'msTenantId');
      const clientId = this.requiredString(body.clientId, 'clientId');
      const clientSecret = this.requiredString(body.clientSecret, 'clientSecret');
      data = {
        ...data,
        msTenantIdCipher: this.encryption.encrypt(msTenantId),
        clientIdCipher: this.encryption.encrypt(clientId),
        clientSecretCipher: this.encryption.encrypt(clientSecret),
      };
    }

    const credential = await this.prisma.emailProviderCredential.create({ data });
    return this.toProviderResponse(credential);
  }

  async listProviders(tenantId: string) {
    const credentials = await this.prisma.emailProviderCredential.findMany({
      where: { tenantId },
      orderBy: { connectedAt: 'desc' },
    });
    return credentials.map((c) => this.toProviderResponse(c));
  }

  async disconnectProvider(tenantId: string, providerId: string) {
    const credential = await this.prisma.emailProviderCredential.findFirst({
      where: { tenantId, id: providerId },
    });
    if (!credential) throw new NotFoundException('Provider credential not found');
    await this.prisma.emailProviderCredential.delete({ where: { id: providerId } });
    return { success: true };
  }

  private toProviderResponse(credential: Record<string, unknown>) {
    const c = credential as {
      id: string;
      tenantId: string;
      providerType: string;
      adminEmailCipher?: string | null;
      serviceAccountCipher?: string | null;
      msTenantIdCipher?: string | null;
      clientIdCipher?: string | null;
      clientSecretCipher?: string | null;
      isActive: boolean;
      connectedAt: Date;
      lastSyncAt: Date | null;
    };
    return {
      id: c.id,
      providerType: c.providerType,
      isActive: c.isActive,
      connectedAt: c.connectedAt,
      lastSyncAt: c.lastSyncAt,
      adminEmail: c.adminEmailCipher ? this.encryption.maskSecret(c.adminEmailCipher) : null,
      serviceAccountJson: c.serviceAccountCipher ? '••••••••' : null,
      msTenantId: c.msTenantIdCipher ? this.encryption.maskSecret(c.msTenantIdCipher) : null,
      clientId: c.clientIdCipher ? this.encryption.maskSecret(c.clientIdCipher) : null,
      clientSecret: c.clientSecretCipher ? '••••••••' : null,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // 2. DOMAIN MANAGEMENT WITH VOLUME CONFIG
  // ═══════════════════════════════════════════════════════════════════

  async addDomainWithVolume(tenantId: string, body: Record<string, unknown>) {
    const domain = this.requiredString(body.domain, 'domain');
    const targetDailyVolume = this.requiredNumber(body.targetDailyVolume, 'targetDailyVolume');
    if (targetDailyVolume < 1) throw new BadRequestException('targetDailyVolume must be at least 1');

    const emailsPerMailbox = 50;
    const requiredMailboxes = Math.ceil(targetDailyVolume / emailsPerMailbox);

    const existing = await this.prisma.sendingDomain.findFirst({ where: { tenantId, domain } });
    if (existing) throw new BadRequestException(`Domain ${domain} is already added`);

    const providerCredentialId = this.optionalString(body.providerCredentialId);
    if (providerCredentialId) {
      const cred = await this.prisma.emailProviderCredential.findFirst({
        where: { tenantId, id: providerCredentialId },
      });
      if (!cred) throw new BadRequestException('Provider credential not found');
    }

    const dnsProvider = this.optionalEnum<DnsProviderType>(
      body.dnsProvider,
      Object.values(DnsProviderType) as DnsProviderType[],
    );
    const dnsApiKey = this.optionalString(body.dnsApiKey);
    const dnsZoneId = this.optionalString(body.dnsZoneId);

    const sendingDomain = await this.prisma.sendingDomain.create({
      data: {
        tenantId,
        domain,
        targetDailyVolume,
        requiredMailboxes,
        providerCredentialId,
        dnsProvider,
        dnsApiKeyCipher: dnsApiKey ? this.encryption.encrypt(dnsApiKey) : undefined,
        dnsZoneId,
      },
    });

    return {
      ...sendingDomain,
      emailsPerMailbox,
      dnsApiKey: sendingDomain.dnsApiKeyCipher ? '••••••••' : null,
      dnsRecords: this.dnsProvider.requiredRecords(sendingDomain),
    };
  }

  async updateDomainVolume(tenantId: string, domainId: string, body: Record<string, unknown>) {
    await this.ensureDomain(tenantId, domainId);
    const targetDailyVolume = this.requiredNumber(body.targetDailyVolume, 'targetDailyVolume');
    if (targetDailyVolume < 1) throw new BadRequestException('targetDailyVolume must be at least 1');

    const emailsPerMailbox = 50;
    const requiredMailboxes = Math.ceil(targetDailyVolume / emailsPerMailbox);

    return this.prisma.sendingDomain.update({
      where: { id: domainId },
      data: { targetDailyVolume, requiredMailboxes },
    });
  }

  async listDomainsWithVolume(tenantId: string) {
    const domains = await this.prisma.sendingDomain.findMany({
      where: { tenantId },
      include: {
        mailboxes: { select: { id: true, status: true, warmupStatus: true } },
        providerCredential: { select: { id: true, providerType: true, isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return domains.map((d) => ({
      id: d.id,
      domain: d.domain,
      targetDailyVolume: d.targetDailyVolume,
      requiredMailboxes: d.requiredMailboxes,
      currentMailboxes: d.mailboxes.length,
      activeMailboxes: d.mailboxes.filter((m) => m.status === 'active').length,
      readyMailboxes: d.mailboxes.filter((m) => m.warmupStatus === 'ready').length,
      warmingMailboxes: d.mailboxes.filter((m) => m.warmupStatus === 'warming').length,
      needsMore: (d.requiredMailboxes ?? 0) > d.mailboxes.length,
      shortfall: Math.max(0, (d.requiredMailboxes ?? 0) - d.mailboxes.length),
      healthScore: d.healthScore,
      spfStatus: d.spfStatus,
      dkimStatus: d.dkimStatus,
      dmarcStatus: d.dmarcStatus,
      mxStatus: d.mxStatus,
      blacklistStatus: d.blacklistStatus,
      dnsProvider: d.dnsProvider,
      hasDnsApiKey: !!d.dnsApiKeyCipher,
      providerCredential: d.providerCredential,
      dnsRecords: this.dnsProvider.requiredRecords(d),
      createdAt: d.createdAt,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════
  // 3. AUTO MAILBOX CREATION (Google / Microsoft APIs)
  // ═══════════════════════════════════════════════════════════════════

  async autoProvisionDomain(tenantId: string, domainId: string, body: Record<string, unknown>) {
    const domain = await this.prisma.sendingDomain.findFirst({
      where: { tenantId, id: domainId },
      include: { providerCredential: true, mailboxes: { select: { email: true } } },
    });
    if (!domain) throw new NotFoundException('Sending domain not found');
    if (!domain.providerCredentialId || !domain.providerCredential) {
      throw new BadRequestException('No email provider connected to this domain. Connect Google Workspace or Microsoft 365 first.');
    }

    const emailFormat = this.requiredEnum<EmailFormat>(
      body.emailFormat,
      Object.values(EmailFormat) as EmailFormat[],
      'emailFormat',
    );
    const companyName = this.optionalString(body.companyName);
    const jobTitle = this.optionalString(body.jobTitle);

    const targetMailboxes = domain.requiredMailboxes ?? Math.ceil((domain.targetDailyVolume ?? 100) / 50);
    const currentCount = domain.mailboxes.length;
    const toCreate = Math.max(0, targetMailboxes - currentCount);

    if (toCreate === 0) {
      return {
        summary: { created: 0, message: 'Domain already has enough mailboxes' },
        mailboxes: [],
      };
    }

    const existingEmails = new Set<string>(domain.mailboxes.map((m) => m.email.toLowerCase()));
    const names = this.generateNames(toCreate, existingEmails);

    const providerType = domain.providerCredential.providerType;
    const credential = domain.providerCredential;

    const createdMailboxes: Array<Record<string, unknown>> = [];

    for (let i = 0; i < names.length; i++) {
      const { firstName, lastName } = names[i];
      const email = this.formatEmail(firstName, lastName, domain.domain, emailFormat);

      const provisionLog = await this.prisma.mailboxProvisioningLog.create({
        data: { tenantId, domainId: domain.id, provider: providerType, email },
      });

      let externalId: string | undefined;
      try {
        const provisioned = providerType === EmailProviderType.google_workspace
          ? await this.createGoogleWorkspaceMailbox(tenantId, credential, email, firstName, lastName)
          : await this.createMicrosoft365Mailbox(tenantId, credential, email, firstName, lastName);
        externalId = provisioned.externalId;
      } catch (error) {
        await this.prisma.mailboxProvisioningLog.update({
          where: { id: provisionLog.id },
          data: {
            status: 'failed',
            failureReason: error instanceof Error ? error.message : String(error),
          },
        });
        throw error;
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const mailbox = await tx.coldMailbox.create({
          data: {
            tenantId,
            provider: providerType === EmailProviderType.google_workspace
              ? MailboxProvider.gmail
              : MailboxProvider.outlook,
            email,
            fromName: `${firstName} ${lastName}`,
            dailySendLimit: 5,
            minDelaySeconds: 180,
            maxDelaySeconds: 480,
            warmupEnabled: true,
            warmupStatus: WarmupStatus.warming,
            warmupStartedAt: new Date(),
            domainId: domain.id,
          },
        });
        await tx.mailboxProvisioningLog.update({
          where: { id: provisionLog.id },
          data: { status: 'succeeded', mailboxId: mailbox.id, externalId, lastSyncAt: new Date() },
        });

        const persona = await tx.persona.create({
          data: {
            tenantId,
            domainId: domain.id,
            mailboxId: mailbox.id,
            firstName,
            lastName,
            email,
            jobTitle,
            companyName,
            warmupStatus: WarmupStatus.warming,
            warmupDay: 1,
            dailySendLimit: 5,
            healthScore: 10,
          },
        });

        const linkedinSlot = await tx.linkedInSlot.create({
          data: { personaId: persona.id },
        });

        return { mailbox, persona, linkedinSlot };
      });

      createdMailboxes.push(result);
    }

    if (domain.dnsProvider && domain.dnsApiKeyCipher) {
      await this.autoConfigureDns(tenantId, domainId);
    }

    return {
      summary: {
        created: createdMailboxes.length,
        domain: domain.domain,
        provider: providerType,
        warmupEnrolled: createdMailboxes.length,
        estimatedWarmupWeeks: 5,
      },
      mailboxes: createdMailboxes,
    };
  }

  private async createGoogleWorkspaceMailbox(
    tenantId: string,
    credential: Record<string, unknown>,
    email: string,
    firstName: string,
    lastName: string,
  ) {
    const cred = credential as {
      adminEmailCipher?: string | null;
      serviceAccountCipher?: string | null;
    };
    if (!cred.adminEmailCipher || !cred.serviceAccountCipher) {
      throw new BadRequestException('Google Workspace credentials are incomplete');
    }

    return this.mailboxProvisioning.provision({
      tenantId,
      provider: EmailProviderType.google_workspace,
      email,
      firstName,
      lastName,
      adminEmail: this.encryption.decrypt(cred.adminEmailCipher),
      serviceAccountJson: this.encryption.decrypt(cred.serviceAccountCipher),
      temporaryPassword: this.generateTemporaryPassword(),
    });
  }

  private async createMicrosoft365Mailbox(
    tenantId: string,
    credential: Record<string, unknown>,
    email: string,
    firstName: string,
    lastName: string,
  ) {
    const cred = credential as {
      msTenantIdCipher?: string | null;
      clientIdCipher?: string | null;
      clientSecretCipher?: string | null;
    };
    if (!cred.msTenantIdCipher || !cred.clientIdCipher || !cred.clientSecretCipher) {
      throw new BadRequestException('Microsoft 365 credentials are incomplete');
    }

    return this.mailboxProvisioning.provision({
      tenantId,
      provider: EmailProviderType.microsoft_365,
      email,
      firstName,
      lastName,
      msTenantId: this.encryption.decrypt(cred.msTenantIdCipher),
      clientId: this.encryption.decrypt(cred.clientIdCipher),
      clientSecret: this.encryption.decrypt(cred.clientSecretCipher),
      temporaryPassword: this.generateTemporaryPassword(),
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 4. DNS AUTO-CONFIGURATION (Cloudflare / Namecheap)
  // ═══════════════════════════════════════════════════════════════════

  async autoConfigureDns(tenantId: string, domainId: string) {
    const domain = await this.prisma.sendingDomain.findFirst({
      where: { tenantId, id: domainId },
    });
    if (!domain) throw new NotFoundException('Sending domain not found');
    if (!domain.dnsProvider || !domain.dnsApiKeyCipher) {
      throw new BadRequestException('DNS provider not configured for this domain');
    }

    const dnsApiKey = this.encryption.decrypt(domain.dnsApiKeyCipher);
    const records = this.dnsProvider.requiredRecords(domain)
      .filter((record) => record.value && (record.key !== 'tracking' || domain.trackingDomain))
      .map((record) => ({
        type: record.type,
        name: record.host,
        value: record.value,
        priority: record.priority ?? undefined,
      }));
    await this.prisma.dnsProvisioningLog.createMany({
      data: records.map((record) => ({
        tenantId,
        domainId,
        provider: domain.dnsProvider!,
        recordType: record.type,
        name: record.name,
        value: record.value,
      })),
    });

    await this.dnsProvider.createRecords({
      tenantId,
      provider: domain.dnsProvider,
      domain: domain.domain,
      zoneId: domain.dnsZoneId,
      apiKey: dnsApiKey,
      records,
    });

    const verification = await this.dnsProvider.verify(domain.domain, domain);

    const updated = await this.prisma.sendingDomain.update({
      where: { id: domainId },
      data: {
        spfStatus: verification.spfValid ? DnsRecordStatus.verified : DnsRecordStatus.not_set,
        dkimStatus: verification.dkimValid ? DnsRecordStatus.verified : DnsRecordStatus.not_set,
        dmarcStatus: verification.dmarcValid ? DnsRecordStatus.verified : DnsRecordStatus.not_set,
        mxStatus: verification.mxValid ? DnsRecordStatus.verified : DnsRecordStatus.not_set,
        trackingDomainActive: verification.trackingValid,
        lastCheckedAt: new Date(),
        healthScore: [verification.spfValid, verification.dkimValid, verification.dmarcValid, verification.mxValid].filter(Boolean).length * 25,
      },
    });
    return {
      ...updated,
      dnsRecords: this.dnsProvider.requiredRecords(updated),
    };
  }

  private async configureCloudfareDns(domain: string, _apiKey: string, _zoneId: string | null) {
    // Cloudflare API calls using zoneId:
    // SPF:   PUT /zones/{zoneId}/dns_records — type: TXT, name: domain, content: "v=spf1 include:_spf.google.com ~all"
    // DKIM:  PUT /zones/{zoneId}/dns_records — type: TXT, name: "google._domainkey.{domain}", content: DKIM key
    // DMARC: PUT /zones/{zoneId}/dns_records — type: TXT, name: "_dmarc.{domain}", content: "v=DMARC1; p=quarantine; rua=mailto:dmarc@{domain}"
    // MX:    PUT /zones/{zoneId}/dns_records — type: MX, name: domain, content: mail server, priority: 10
  }

  private async configureNamecheapDns(domain: string, _apiKey: string) {
    // Namecheap API calls:
    // namecheap.domains.dns.setHosts with SPF, DKIM, DMARC TXT records and MX records
  }

  async connectDomainDns(tenantId: string, domainId: string, body: Record<string, unknown>) {
    await this.ensureDomain(tenantId, domainId);

    const dnsProvider = this.requiredEnum<DnsProviderType>(
      body.dnsProvider,
      Object.values(DnsProviderType) as DnsProviderType[],
      'dnsProvider',
    );
    const dnsApiKey = this.requiredString(body.dnsApiKey, 'dnsApiKey');
    const dnsZoneId = this.optionalString(body.dnsZoneId);

    if (dnsProvider === DnsProviderType.cloudflare && !dnsZoneId) {
      throw new BadRequestException('dnsZoneId is required for Cloudflare');
    }

    return this.prisma.sendingDomain.update({
      where: { id: domainId },
      data: {
        dnsProvider,
        dnsApiKeyCipher: this.encryption.encrypt(dnsApiKey),
        dnsZoneId,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 5. AUTO WARMUP ENROLLMENT & ENFORCEMENT
  // ═══════════════════════════════════════════════════════════════════

  async checkWarmupHealth(tenantId: string) {
    const personas = await this.prisma.persona.findMany({
      where: {
        tenantId,
        warmupStatus: { in: [WarmupStatus.warming, WarmupStatus.ready] },
      },
      include: { mailbox: true },
    });

    const paused: string[] = [];
    const blocked: string[] = [];

    for (const persona of personas) {
      const bounceRate = Number(persona.bounceRate);
      const spamRate = Number(persona.spamRate);

      if (bounceRate > 5 || spamRate > 0.1) {
        await this.prisma.persona.update({
          where: { id: persona.id },
          data: { warmupStatus: WarmupStatus.paused },
        });
        if (persona.mailboxId) {
          await this.prisma.coldMailbox.update({
            where: { id: persona.mailboxId },
            data: { warmupStatus: WarmupStatus.paused, status: MailboxStatus.paused },
          });
        }
        paused.push(persona.email);
      }

      if (persona.healthScore < 80 && persona.warmupStatus === WarmupStatus.ready) {
        blocked.push(persona.email);
      }
    }

    return { paused, blocked, checkedCount: personas.length };
  }

  async canSendCampaign(tenantId: string, mailboxId: string) {
    const mailbox = await this.prisma.coldMailbox.findFirst({
      where: { tenantId, id: mailboxId },
    });
    if (!mailbox) throw new NotFoundException('Mailbox not found');

    const persona = await this.prisma.persona.findFirst({
      where: { tenantId, mailboxId },
    });

    const isWarmedUp = mailbox.warmupStatus === WarmupStatus.ready;
    const healthOk = persona ? persona.healthScore >= 80 : isWarmedUp;
    const underDailyLimit = mailbox.sentToday < 50;
    const bounceOk = Number(mailbox.bounceRate) <= 5;
    const spamOk = Number(mailbox.spamRate) <= 0.1;

    return {
      canSend: isWarmedUp && healthOk && underDailyLimit && bounceOk && spamOk,
      reasons: [
        ...(!isWarmedUp ? ['Mailbox warmup not complete'] : []),
        ...(!healthOk ? ['Health score below 80'] : []),
        ...(!underDailyLimit ? ['Daily send limit reached (50/day)'] : []),
        ...(!bounceOk ? ['Bounce rate exceeds 5%'] : []),
        ...(!spamOk ? ['Spam rate exceeds 0.1%'] : []),
      ],
      mailboxId,
      warmupStatus: mailbox.warmupStatus,
      healthScore: persona?.healthScore ?? 0,
      sentToday: mailbox.sentToday,
      bounceRate: Number(mailbox.bounceRate),
      spamRate: Number(mailbox.spamRate),
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // 6. SMART SENDING DISTRIBUTION
  // ═══════════════════════════════════════════════════════════════════

  async getSmartDistribution(tenantId: string) {
    const personas = await this.prisma.persona.findMany({
      where: {
        tenantId,
        warmupStatus: WarmupStatus.ready,
      },
      include: { domain: true, mailbox: true },
      orderBy: { domainId: 'asc' },
    });

    const availablePersonas = personas.filter((p) => {
      if (!p.mailbox) return false;
      if (p.mailbox.status === MailboxStatus.paused) return false;
      if (Number(p.bounceRate) > 5) return false;
      if (Number(p.spamRate) > 0.1) return false;
      if (p.healthScore < 80) return false;
      return true;
    });

    const domainGroups = new Map<string, typeof availablePersonas>();
    for (const p of availablePersonas) {
      const key = p.domainId;
      if (!domainGroups.has(key)) domainGroups.set(key, []);
      domainGroups.get(key)!.push(p);
    }

    const roundRobinOrder: Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      domain: string;
      dailySendLimit: number;
      sentToday: number;
      remaining: number;
      healthScore: number;
      minDelaySeconds: number;
      maxDelaySeconds: number;
    }> = [];

    const domainArrays = Array.from(domainGroups.values());
    const maxLen = Math.max(0, ...domainArrays.map((arr) => arr.length));

    for (let i = 0; i < maxLen; i++) {
      for (const arr of domainArrays) {
        if (i < arr.length) {
          const p = arr[i];
          const limit = Math.min(p.dailySendLimit, 50);
          roundRobinOrder.push({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            email: p.email,
            domain: p.domain.domain,
            dailySendLimit: limit,
            sentToday: p.sentToday,
            remaining: Math.max(0, limit - p.sentToday),
            healthScore: p.healthScore,
            minDelaySeconds: p.mailbox?.minDelaySeconds ?? 180,
            maxDelaySeconds: p.mailbox?.maxDelaySeconds ?? 480,
          });
        }
      }
    }

    const totalDailyCapacity = roundRobinOrder.reduce((sum, p) => sum + p.dailySendLimit, 0);
    const totalSentToday = roundRobinOrder.reduce((sum, p) => sum + p.sentToday, 0);
    const totalRemaining = roundRobinOrder.reduce((sum, p) => sum + p.remaining, 0);

    const pausedCount = personas.length - availablePersonas.length;

    return {
      aggregate: {
        totalPersonas: roundRobinOrder.length,
        totalDailyCapacity,
        totalSentToday,
        totalRemaining,
        hardLimitPerMailbox: 50,
        delayRange: { min: 180, max: 480 },
        pausedMailboxes: pausedCount,
        rebalanced: pausedCount > 0,
      },
      distribution: roundRobinOrder,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // ORIGINAL PROVISIONING METHODS (preserved)
  // ═══════════════════════════════════════════════════════════════════

  calculate(tenantId: string, body: Record<string, unknown>) {
    const domains = this.requiredArray(body.domains, 'domains');
    const targetDailyVolume = this.requiredNumber(body.targetDailyVolume, 'targetDailyVolume');
    const emailsPerMailbox = 50;

    if (domains.length === 0) throw new BadRequestException('At least one domain is required');
    if (targetDailyVolume < 1) throw new BadRequestException('targetDailyVolume must be at least 1');

    const totalDomains = domains.length;
    const mailboxesNeeded = Math.ceil(targetDailyVolume / emailsPerMailbox);
    const mailboxesPerDomain = Math.ceil(mailboxesNeeded / totalDomains);
    const estimatedWarmupWeeks = 5;

    return {
      totalDomains,
      dailyTarget: targetDailyVolume,
      mailboxesNeeded,
      mailboxesPerDomain,
      emailsPerMailbox,
      estimatedWarmupWeeks,
    };
  }

  async provision(tenantId: string, body: Record<string, unknown>) {
    const domains = this.requiredArray(body.domains, 'domains');
    const targetDailyVolume = this.requiredNumber(body.targetDailyVolume, 'targetDailyVolume');
    const emailFormat = this.requiredEnum<EmailFormat>(body.emailFormat, Object.values(EmailFormat) as EmailFormat[], 'emailFormat');
    const companyName = this.optionalString(body.companyName);
    const jobTitle = this.optionalString(body.jobTitle);

    if (domains.length === 0) throw new BadRequestException('At least one domain is required');
    if (targetDailyVolume < 1) throw new BadRequestException('targetDailyVolume must be at least 1');

    const emailsPerMailbox = 50;
    const mailboxesPerDomain = Math.ceil(targetDailyVolume / emailsPerMailbox / domains.length);
    const totalMailboxes = mailboxesPerDomain * domains.length;

    const existingPersonas = await this.prisma.persona.findMany({
      where: { tenantId },
      select: { email: true },
    });
    const existingEmails = new Set<string>(existingPersonas.map((p: { email: string }) => p.email.toLowerCase()));

    const names = this.generateNames(totalMailboxes, existingEmails);

    const createdDomains: Array<{ id: string; domain: string }> = [];
    const createdPersonas: Array<Record<string, unknown>> = [];
    let nameIndex = 0;

    for (const domainName of domains) {
      const d = this.requiredString(domainName, 'domain');

      let sendingDomain = await this.prisma.sendingDomain.findFirst({
        where: { tenantId, domain: d },
      });

      if (!sendingDomain) {
        sendingDomain = await this.prisma.sendingDomain.create({
          data: {
            tenantId,
            domain: d,
            targetDailyVolume: Math.ceil(targetDailyVolume / domains.length),
            requiredMailboxes: mailboxesPerDomain,
          },
        });
      } else {
        await this.prisma.sendingDomain.update({
          where: { id: sendingDomain.id },
          data: {
            targetDailyVolume: Math.ceil(targetDailyVolume / domains.length),
            requiredMailboxes: mailboxesPerDomain,
          },
        });
      }

      createdDomains.push({ id: sendingDomain.id, domain: sendingDomain.domain });

      for (let i = 0; i < mailboxesPerDomain; i++) {
        if (nameIndex >= names.length) break;

        const { firstName, lastName } = names[nameIndex];
        const email = this.formatEmail(firstName, lastName, d, emailFormat);
        nameIndex++;

        const persona = await this.prisma.$transaction(async (tx) => {
          const mailbox = await tx.coldMailbox.create({
            data: {
              tenantId,
              provider: MailboxProvider.custom_smtp,
              email,
              fromName: `${firstName} ${lastName}`,
              dailySendLimit: 5,
              minDelaySeconds: 180,
              maxDelaySeconds: 480,
              warmupEnabled: true,
              warmupStatus: WarmupStatus.warming,
              warmupStartedAt: new Date(),
              domainId: sendingDomain!.id,
            },
          });

          const p = await tx.persona.create({
            data: {
              tenantId,
              domainId: sendingDomain!.id,
              mailboxId: mailbox.id,
              firstName,
              lastName,
              email,
              jobTitle,
              companyName,
              warmupStatus: WarmupStatus.warming,
              warmupDay: 1,
              dailySendLimit: 5,
            },
          });

          const linkedinSlot = await tx.linkedInSlot.create({
            data: { personaId: p.id },
          });

          return { ...p, mailbox, linkedinSlot };
        });

        createdPersonas.push(persona);
      }
    }

    return {
      summary: {
        totalDomains: createdDomains.length,
        totalPersonas: createdPersonas.length,
        totalMailboxes: createdPersonas.length,
        emailFormat,
        mailboxesPerDomain,
        estimatedWarmupWeeks: 5,
      },
      domains: createdDomains,
      personas: createdPersonas,
    };
  }

  listPersonas(tenantId: string) {
    return this.prisma.persona.findMany({
      where: { tenantId },
      include: { domain: true, linkedinSlot: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPersona(tenantId: string, id: string) {
    const persona = await this.prisma.persona.findFirst({
      where: { tenantId, id },
      include: {
        domain: true,
        mailbox: true,
        linkedinSlot: true,
        warmupLogs: {
          orderBy: { date: 'desc' },
          take: 14,
        },
        sendingLogs: {
          orderBy: { sentAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!persona) throw new NotFoundException('Persona not found');
    return persona;
  }

  async updatePersona(tenantId: string, id: string, body: Record<string, unknown>) {
    await this.ensurePersona(tenantId, id);
    return this.prisma.persona.update({
      where: { id },
      data: {
        jobTitle: this.optionalString(body.jobTitle),
        companyName: this.optionalString(body.companyName),
        phone: this.optionalString(body.phone),
        profilePhoto: this.optionalString(body.profilePhoto),
        signature: this.optionalString(body.signature),
      },
    });
  }

  async deletePersona(tenantId: string, id: string) {
    await this.ensurePersona(tenantId, id);
    await this.prisma.persona.delete({ where: { id } });
    return { success: true };
  }

  async updateLinkedInSlot(tenantId: string, personaId: string, body: Record<string, unknown>) {
    const persona = await this.ensurePersona(tenantId, personaId);

    const slot = await this.prisma.linkedInSlot.findUnique({
      where: { personaId },
    });
    if (!slot) throw new NotFoundException('LinkedIn slot not found for this persona');

    return this.prisma.linkedInSlot.update({
      where: { personaId },
      data: {
        profileUrl: this.optionalString(body.profileUrl),
        headline: this.optionalString(body.headline),
        suggestedBio: this.optionalString(body.suggestedBio),
        connected: this.optionalBoolean(body.connected),
      },
    });
  }

  async listDomainHealth(tenantId: string) {
    const domains = await this.prisma.sendingDomain.findMany({
      where: { tenantId },
      include: {
        mailboxes: {
          select: {
            id: true,
            email: true,
            status: true,
            warmupStatus: true,
            sentToday: true,
            dailySendLimit: true,
            bounceRate: true,
            spamRate: true,
            healthScore: true,
            warmupDailyTarget: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return domains.map((domain) => {
      const totalMailboxes = domain.mailboxes.length;
      const activeMailboxes = domain.mailboxes.filter((m) => m.status === 'active' && m.warmupStatus === 'ready').length;
      const warmingMailboxes = domain.mailboxes.filter((m) => m.warmupStatus === 'warming').length;
      const pausedMailboxes = domain.mailboxes.filter((m) => m.status === 'paused').length;
      const todaysSent = domain.mailboxes.reduce((sum, m) => sum + m.sentToday, 0);
      const totalDailyCapacity = domain.mailboxes.reduce((sum, m) => sum + m.dailySendLimit, 0);

      return {
        id: domain.id,
        domain: domain.domain,
        healthScore: domain.healthScore,
        blacklistStatus: domain.blacklistStatus,
        blacklistCheckedAt: domain.blacklistCheckedAt,
        spfStatus: domain.spfStatus,
        dkimStatus: domain.dkimStatus,
        dmarcStatus: domain.dmarcStatus,
        mxStatus: domain.mxStatus,
        targetDailyVolume: domain.targetDailyVolume,
        requiredMailboxes: domain.requiredMailboxes,
        totalMailboxes,
        activeMailboxes,
        warmingMailboxes,
        pausedMailboxes,
        todaysSent,
        totalDailyCapacity,
        mailboxes: domain.mailboxes.map((m) => ({
          email: m.email,
          warmupStatus: m.warmupStatus,
          healthScore: m.healthScore,
          sentToday: m.sentToday,
          dailyLimit: m.dailySendLimit,
          bounceRate: Number(m.bounceRate),
          spamRate: Number(m.spamRate),
        })),
      };
    });
  }

  async getDomainHealth(tenantId: string, domainId: string) {
    const domain = await this.prisma.sendingDomain.findFirst({
      where: { tenantId, id: domainId },
      include: {
        personas: {
          include: { linkedinSlot: true },
          orderBy: { createdAt: 'asc' },
        },
        healthLogs: {
          orderBy: { checkedAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!domain) throw new NotFoundException('Sending domain not found');

    const personasWithStats = domain.personas.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      warmupStatus: p.warmupStatus,
      warmupDay: p.warmupDay,
      healthScore: p.healthScore,
      dailySendLimit: p.dailySendLimit,
      sentToday: p.sentToday,
      totalSent: p.totalSent,
      bounceRate: p.bounceRate,
      spamRate: p.spamRate,
      linkedinConnected: p.linkedinConnected,
    }));

    return {
      id: domain.id,
      domain: domain.domain,
      healthScore: domain.healthScore,
      blacklistStatus: domain.blacklistStatus,
      blacklistCheckedAt: domain.blacklistCheckedAt,
      spfStatus: domain.spfStatus,
      dkimStatus: domain.dkimStatus,
      dmarcStatus: domain.dmarcStatus,
      mxStatus: domain.mxStatus,
      targetDailyVolume: domain.targetDailyVolume,
      requiredMailboxes: domain.requiredMailboxes,
      lastCheckedAt: domain.lastCheckedAt,
      healthLogs: domain.healthLogs,
      personas: personasWithStats,
    };
  }

  async checkDomainHealth(tenantId: string, domainId: string) {
    const domain = await this.prisma.sendingDomain.findFirst({
      where: { tenantId, id: domainId },
      include: {
        mailboxes: {
          select: { bounceRate: true, spamRate: true },
        },
      },
    });
    if (!domain) throw new NotFoundException('Sending domain not found');

    const spfValid = domain.spfStatus === DnsRecordStatus.verified;
    const dkimValid = domain.dkimStatus === DnsRecordStatus.verified;
    const dmarcValid = domain.dmarcStatus === DnsRecordStatus.verified;
    const mxValid = domain.mxStatus === DnsRecordStatus.verified;

    let healthScore = 0;
    if (spfValid) healthScore += 25;
    if (dkimValid) healthScore += 25;
    if (dmarcValid) healthScore += 25;
    if (mxValid) healthScore += 25;

    const blacklistStatus = 'clean';
    if (blacklistStatus !== 'clean') {
      healthScore = Math.max(0, healthScore - 50);
    }

    if (domain.mailboxes.length > 0) {
      const avgBounce = domain.mailboxes.reduce((sum, m) => sum + Number(m.bounceRate), 0) / domain.mailboxes.length;
      const avgSpam = domain.mailboxes.reduce((sum, m) => sum + Number(m.spamRate), 0) / domain.mailboxes.length;

      if (avgBounce > 3) healthScore = Math.max(0, healthScore - 20);
      if (avgSpam > 0.1) healthScore = Math.max(0, healthScore - 30);
    }

    await this.prisma.domainHealthLog.create({
      data: {
        domainId,
        blacklistStatus,
        spfValid,
        dkimValid,
        dmarcValid,
        healthScore,
      },
    });

    return this.prisma.sendingDomain.update({
      where: { id: domainId },
      data: {
        blacklistStatus,
        blacklistCheckedAt: new Date(),
        healthScore,
        lastCheckedAt: new Date(),
      },
    });
  }

  async getWarmupDashboard(tenantId: string) {
    const personas = await this.prisma.persona.findMany({
      where: { tenantId },
      include: { domain: true },
      orderBy: { warmupDay: 'desc' },
    });

    const grouped: Record<string, Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      domain: string;
      warmupDay: number;
      dailySendLimit: number;
      sentToday: number;
      healthScore: number;
      progress: number;
    }>> = {
      not_started: [],
      warming: [],
      ready: [],
      paused: [],
    };

    for (const p of personas) {
      const progress = Math.min(100, Math.round((p.warmupDay / 35) * 100));
      const entry = {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        domain: p.domain.domain,
        warmupDay: p.warmupDay,
        dailySendLimit: p.dailySendLimit,
        sentToday: p.sentToday,
        healthScore: p.healthScore,
        progress,
      };

      const status = p.warmupStatus as string;
      if (grouped[status]) {
        grouped[status].push(entry);
      }
    }

    return {
      summary: {
        total: personas.length,
        notStarted: grouped.not_started.length,
        warming: grouped.warming.length,
        ready: grouped.ready.length,
        paused: grouped.paused.length,
      },
      groups: grouped,
    };
  }

  async advanceWarmup(tenantId: string, personaId: string) {
    const persona = await this.ensurePersona(tenantId, personaId);

    if (Number(persona.bounceRate) > 5 || Number(persona.spamRate) > 0.1) {
      await this.prisma.persona.update({
        where: { id: personaId },
        data: { warmupStatus: WarmupStatus.paused },
      });
      if (persona.mailboxId) {
        await this.prisma.coldMailbox.update({
          where: { id: persona.mailboxId },
          data: { warmupStatus: WarmupStatus.paused, status: MailboxStatus.paused },
        });
      }
      throw new BadRequestException('Cannot advance warmup: bounce rate > 5% or spam rate > 0.1%. Mailbox auto-paused.');
    }

    const newWarmupDay = persona.warmupDay + 1;
    const dailySendLimit = this.calculateDailySendLimit(newWarmupDay);
    const warmupStatus = newWarmupDay >= 35 ? WarmupStatus.ready : WarmupStatus.warming;
    const healthScore = newWarmupDay >= 35
      ? 85
      : this.calculatePersonaHealth(newWarmupDay, Number(persona.bounceRate), Number(persona.spamRate));

    const updated = await this.prisma.persona.update({
      where: { id: personaId },
      data: {
        warmupDay: newWarmupDay,
        dailySendLimit,
        warmupStatus,
        healthScore,
      },
    });

    if (persona.mailboxId) {
      await this.prisma.coldMailbox.update({
        where: { id: persona.mailboxId },
        data: {
          dailySendLimit,
          warmupStatus,
        },
      });
    }

    return updated;
  }

  async getDistribution(tenantId: string) {
    return this.getSmartDistribution(tenantId);
  }

  // ---------------------------------------------------------------------------
  // Name & email generation
  // ---------------------------------------------------------------------------

  private generateNames(count: number, existingEmails: Set<string>): Array<{ firstName: string; lastName: string }> {
    const result: Array<{ firstName: string; lastName: string }> = [];
    const usedCombos = new Set<string>();

    for (const email of existingEmails) {
      usedCombos.add(email.toLowerCase());
    }

    let attempts = 0;
    const maxAttempts = count * 20;

    while (result.length < count && attempts < maxAttempts) {
      attempts++;
      const firstName = this.firstNames[Math.floor(Math.random() * this.firstNames.length)];
      const lastName = this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
      const combo = `${firstName.toLowerCase()}_${lastName.toLowerCase()}`;

      if (!usedCombos.has(combo)) {
        usedCombos.add(combo);
        result.push({ firstName, lastName });
      }
    }

    if (result.length < count) {
      throw new BadRequestException(
        `Could only generate ${result.length} unique names out of ${count} requested. Add more domains or reduce target volume.`,
      );
    }

    return result;
  }

  private formatEmail(firstName: string, lastName: string, domain: string, format: EmailFormat): string {
    const f = firstName.toLowerCase();
    const l = lastName.toLowerCase();

    switch (format) {
      case EmailFormat.firstname_at:
        return `${f}@${domain}`;
      case EmailFormat.firstname_dot_lastname:
        return `${f}.${l}@${domain}`;
      case EmailFormat.firstnamelastname:
        return `${f}${l}@${domain}`;
      case EmailFormat.f_dot_lastname:
        return `${f.charAt(0)}.${l}@${domain}`;
      default: {
        const _exhaustive: never = format;
        throw new BadRequestException(`Unsupported email format: ${_exhaustive}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Health score calculations
  // ---------------------------------------------------------------------------

  private calculateDailySendLimit(warmupDay: number): number {
    if (warmupDay <= 7) return 5;
    if (warmupDay <= 14) return 10;
    if (warmupDay <= 21) return 20;
    if (warmupDay <= 28) return 35;
    return 50;
  }

  private calculatePersonaHealth(warmupDay: number, bounceRate: number, spamRate: number): number {
    let score = Math.round((Math.min(warmupDay, 35) / 35) * 50);
    if (bounceRate < 2) score += 25;
    if (spamRate < 0.05) score += 25;
    return Math.min(100, score);
  }

  private requiredDnsRecords(domain: string) {
    return [
      { type: 'TXT', name: domain, value: 'v=spf1 include:_spf.google.com include:sendgrid.net ~all' },
      { type: 'TXT', name: `_dmarc.${domain}`, value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}` },
      { type: 'MX', name: domain, value: 'aspmx.l.google.com', priority: 1 },
      { type: 'CNAME', name: `track.${domain}`, value: 'sendgrid.net' },
    ];
  }

  private generateTemporaryPassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 18; i++) {
      password += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return password;
  }

  // ---------------------------------------------------------------------------
  // Ensure helpers (tenant-scoped lookups)
  // ---------------------------------------------------------------------------

  private async ensurePersona(tenantId: string, id: string) {
    const persona = await this.prisma.persona.findFirst({ where: { tenantId, id } });
    if (!persona) throw new NotFoundException('Persona not found');
    return persona;
  }

  private async ensureDomain(tenantId: string, domainId: string) {
    const domain = await this.prisma.sendingDomain.findFirst({ where: { tenantId, id: domainId } });
    if (!domain) throw new NotFoundException('Sending domain not found');
    return domain;
  }

  // ---------------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------------

  private requiredString(value: unknown, field: string) {
    if (typeof value !== 'string' || value.trim().length === 0) throw new BadRequestException(`${field} is required`);
    return value.trim();
  }

  private requiredNumber(value: unknown, field: string) {
    if (value === undefined || value === null) throw new BadRequestException(`${field} is required`);
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new BadRequestException(`${field} must be a valid number`);
    return parsed;
  }

  private requiredEnum<T extends string>(value: unknown, allowed: T[], field: string) {
    if (typeof value !== 'string' || value.trim().length === 0) throw new BadRequestException(`${field} is required`);
    if (!allowed.includes(value as T)) throw new BadRequestException(`${field} must be one of: ${allowed.join(', ')}`);
    return value as T;
  }

  private requiredArray(value: unknown, field: string): unknown[] {
    if (!Array.isArray(value) || value.length === 0) throw new BadRequestException(`${field} is required and must not be empty`);
    return value;
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  }

  private optionalNumber(value: unknown, fallback?: number) {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new BadRequestException('Invalid number value');
    return parsed;
  }

  private optionalBoolean(value: unknown, fallback?: boolean) {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return fallback;
  }

  private optionalEnum<T extends string>(value: unknown, allowed: T[], fallback?: T) {
    if (value === undefined || value === null || value === '') return fallback;
    if (!allowed.includes(value as T)) throw new BadRequestException('Invalid enum value');
    return value as T;
  }

  // ═══════════════════════════════════════════════════════════════════
  // DOMAIN PURCHASE PIPELINE (Inframail)
  // ═══════════════════════════════════════════════════════════════════

  generateDomainVariations(baseName: string, quantity: number): string[] {
    const name = baseName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!name) return [];

    const suffixes = ['mail', 'reach', 'hq', 'outreach', 'sends', 'inbox', 'connect', 'works', 'team', 'hub'];
    const prefixes = ['get', 'try', 'use', 'go', 'my', 'the'];
    const bizSuffixes = ['solutions', 'group', 'digital', 'agency', 'labs', 'media', 'consulting', 'co', 'studio', 'tech'];
    const separators = ['', '-'];
    const tlds = ['.com', '.io', '.co', '.net', '.org'];

    const variations = new Set<string>();

    for (const tld of tlds) {
      variations.add(`${name}${tld}`);
      for (const suffix of suffixes) {
        for (const sep of separators) {
          variations.add(`${name}${sep}${suffix}${tld}`);
        }
      }
      for (const prefix of prefixes) {
        variations.add(`${prefix}${name}${tld}`);
        variations.add(`${prefix}-${name}${tld}`);
      }
      for (const suffix of bizSuffixes) {
        for (const sep of separators) {
          variations.add(`${name}${sep}${suffix}${tld}`);
        }
      }
    }

    const arr = [...variations];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, Math.min(quantity * 5, 50));
  }

  async createDomainPurchaseOrder(tenantId: string, userId: string, body: Record<string, unknown>) {
    const baseName = this.requiredString(body.baseName, 'baseName');
    const quantity = this.optionalNumber(body.quantity, 5) ?? 5;
    const registrarProvider = this.optionalString(body.registrarProvider) ?? 'namecheap';
    const emailFormat = this.optionalString(body.emailFormat) ?? 'firstname.lastname';
    const mailboxesPerDomain = this.optionalNumber(body.mailboxesPerDomain, 1) ?? 1;
    const companyName = this.optionalString(body.companyName);
    const jobTitle = this.optionalString(body.jobTitle) ?? 'Sales Development Rep';
    const providerCredentialId = this.optionalString(body.providerCredentialId);

    await this.domainRegistrar.getRegistrarCredentials(tenantId, registrarProvider);

    const cfIntegration = await this.prisma.tenantIntegration.findFirst({ where: { tenantId, platformKey: 'cloudflare', isActive: true } });
    if (!cfIntegration) throw new BadRequestException('Cloudflare is not connected. Go to Settings > Integrations.');

    if (providerCredentialId) {
      const cred = await this.prisma.emailProviderCredential.findFirst({ where: { id: providerCredentialId, tenantId } });
      if (!cred) throw new BadRequestException('Email provider credential not found');
    }

    const domainVariations = this.generateDomainVariations(baseName, quantity);
    const domainItems = domainVariations.map((d) => {
      const parts = d.split('.');
      const tld = parts.slice(1).join('.');
      return {
        domain: d, tld, available: null, price: null, currency: 'USD', selected: false,
        purchaseStatus: 'pending', dnsStatus: 'pending', mailboxStatus: 'pending', warmupStatus: 'pending',
      };
    });

    const order = await this.prisma.domainPurchaseOrder.create({
      data: {
        tenantId, baseName, quantity, mailboxesPerDomain, registrarProvider, status: 'generating',
        domains: domainItems as any, emailFormat, companyName, jobTitle,
        providerCredentialId, createdBy: userId,
      },
    });

    await this.jobs.enqueue(tenantId, 'domain-purchase-pipeline', 'check_availability', { orderId: order.id, phase: 'check_availability' });
    return order;
  }

  async getDomainPurchaseOrder(tenantId: string, orderId: string) {
    const order = await this.prisma.domainPurchaseOrder.findFirst({ where: { id: orderId, tenantId } });
    if (!order) throw new NotFoundException('Purchase order not found');
    return order;
  }

  async listDomainPurchaseOrders(tenantId: string) {
    return this.prisma.domainPurchaseOrder.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async confirmDomainSelection(tenantId: string, orderId: string, body: Record<string, unknown>) {
    const order = await this.getDomainPurchaseOrder(tenantId, orderId);
    if (order.status !== 'awaiting_confirmation') throw new BadRequestException('Order is not awaiting confirmation');

    const selectedDomains = Array.isArray(body.selectedDomains) ? body.selectedDomains.filter((d): d is string => typeof d === 'string') : [];
    if (selectedDomains.length === 0) throw new BadRequestException('Select at least one domain');

    const selectedSet = new Set(selectedDomains);
    const domains = (order.domains as any[]).map((d: any) => ({
      ...d,
      selected: selectedSet.has(d.domain),
    }));
    const totalCost = domains.filter((d: any) => d.selected && d.available).reduce((sum: number, d: any) => sum + (d.price ?? 0), 0);

    await this.prisma.domainPurchaseOrder.update({
      where: { id: orderId },
      data: { domains: domains as any, totalCost, status: 'purchasing' },
    });

    await this.jobs.enqueue(tenantId, 'domain-purchase-pipeline', 'purchase_domains', { orderId, phase: 'purchase_domains' });
    return this.getDomainPurchaseOrder(tenantId, orderId);
  }

  async retryFailedDomains(tenantId: string, orderId: string) {
    const order = await this.getDomainPurchaseOrder(tenantId, orderId);
    if (order.status !== 'failed' && order.status !== 'completed') throw new BadRequestException('Order cannot be retried');

    const domains = (order.domains as any[]).map((d: any) => {
      if (d.selected && d.purchaseStatus === 'failed') return { ...d, purchaseStatus: 'pending' };
      if (d.dnsStatus === 'failed') return { ...d, dnsStatus: 'pending' };
      if (d.mailboxStatus === 'failed') return { ...d, mailboxStatus: 'pending' };
      return d;
    });

    const hasRetryable = domains.some((d: any) => d.purchaseStatus === 'pending' || d.dnsStatus === 'pending' || d.mailboxStatus === 'pending');
    if (!hasRetryable) throw new BadRequestException('No failed domains to retry');

    const hasPurchasePending = domains.some((d: any) => d.selected && d.purchaseStatus === 'pending');
    const phase = hasPurchasePending ? 'purchase_domains' : 'configure_dns';

    await this.prisma.domainPurchaseOrder.update({
      where: { id: orderId },
      data: { domains: domains as any, status: phase === 'purchase_domains' ? 'purchasing' : 'configuring_dns', lastError: null },
    });

    await this.jobs.enqueue(tenantId, 'domain-purchase-pipeline', phase, { orderId, phase });
    return this.getDomainPurchaseOrder(tenantId, orderId);
  }
}
