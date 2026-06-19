import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PlanKey, Prisma, TenantStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from './encryption.service';

const serviceKeys = ['crm', 'email_marketing', 'cold_email', 'ai_assistant', 'analytics', 'api_access'];
const planKeys = Object.values(PlanKey);
const tenantStatuses = Object.values(TenantStatus);

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async list() {
    const tenants = await this.prisma.tenant.findMany({
      include: {
        enabledServices: true,
        integrations: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return tenants.map((tenant) => this.toTenantResponse(tenant));
  }

  async get(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        enabledServices: true,
        integrations: true,
      },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');

    return this.toTenantResponse(tenant);
  }

  async create(body: Record<string, unknown>, actorUserId: string) {
    const data = this.parseTenantInput(body, true);

    const tenantId = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          companyName: data.companyName ?? this.requiredString(body.companyName, 'companyName'),
          contactName: data.contactName ?? this.requiredString(body.contactName, 'contactName'),
          email: data.email ?? this.requiredString(body.email, 'email'),
          phone: data.phone,
          industry: data.industry,
          plan: data.plan ?? PlanKey.starter,
          status: data.status ?? TenantStatus.trial,
          seats: data.seats ?? 1,
          mrr: data.mrr ?? 0,
          trialEndsAt: data.trialEndsAt,
          notes: data.notes,
          enabledServices: {
            create: (data.enabledServices ?? []).map((key) => ({ key })),
          },
        },
      });

      await this.audit(tx, actorUserId, created.id, 'tenant.created', { companyName: created.companyName });
      return created.id;
    });

    return this.get(tenantId);
  }

  async update(tenantId: string, body: Record<string, unknown>, actorUserId: string) {
    await this.ensureTenant(tenantId);
    const data = this.parseTenantInput(body, false);

    await this.prisma.$transaction(async (tx) => {
      if (data.enabledServices) {
        await tx.tenantService.deleteMany({ where: { tenantId } });
        if (data.enabledServices.length) {
          await tx.tenantService.createMany({
            data: data.enabledServices.map((key) => ({ tenantId, key })),
          });
        }
      }

      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          companyName: data.companyName,
          contactName: data.contactName,
          email: data.email,
          phone: data.phone,
          industry: data.industry,
          plan: data.plan,
          status: data.status,
          seats: data.seats,
          mrr: data.mrr,
          trialEndsAt: data.trialEndsAt,
          notes: data.notes,
        },
        include: {
          enabledServices: true,
          integrations: true,
        },
      });

      await this.audit(tx, actorUserId, tenantId, 'tenant.updated', { fields: Object.keys(body) });
    });

    return this.get(tenantId);
  }

  async remove(tenantId: string, actorUserId: string) {
    await this.ensureTenant(tenantId);

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.delete({ where: { id: tenantId } });
      await this.audit(tx, actorUserId, tenantId, 'tenant.deleted', {});
    });

    return { success: true };
  }

  async addIntegration(tenantId: string, body: Record<string, unknown>, actorUserId: string) {
    await this.ensureTenant(tenantId);
    const platformKey = this.requiredString(body.platformKey, 'platformKey');
    const apiKey = this.requiredString(body.apiKey, 'apiKey');
    const monthlyPrice = this.optionalNumber(body.monthlyPrice, 0);

    const integration = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenantIntegration.create({
        data: {
          tenantId,
          platformKey,
          customName: this.optionalString(body.customName),
          apiKeyCipher: this.encryption.encrypt(apiKey),
          monthlyPrice: monthlyPrice ?? 0,
          isActive: this.optionalBoolean(body.isActive, true),
          notes: this.optionalString(body.notes),
        },
      });

      await this.audit(tx, actorUserId, tenantId, 'tenant.integration.created', { platformKey });
      return created;
    });

    return this.toIntegrationResponse(integration);
  }

  async updateIntegration(
    tenantId: string,
    integrationId: string,
    body: Record<string, unknown>,
    actorUserId: string,
  ) {
    await this.ensureIntegration(tenantId, integrationId);

    const integration = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenantIntegration.update({
        where: { id: integrationId },
        data: {
          platformKey: this.optionalString(body.platformKey),
          customName: this.optionalString(body.customName),
          apiKeyCipher: typeof body.apiKey === 'string' ? this.encryption.encrypt(body.apiKey) : undefined,
          monthlyPrice: this.optionalNumber(body.monthlyPrice),
          isActive: this.optionalBoolean(body.isActive),
          notes: this.optionalString(body.notes),
        },
      });

      await this.audit(tx, actorUserId, tenantId, 'tenant.integration.updated', {
        integrationId,
        fields: Object.keys(body),
      });
      return updated;
    });

    return this.toIntegrationResponse(integration);
  }

  async removeIntegration(tenantId: string, integrationId: string, actorUserId: string) {
    await this.ensureIntegration(tenantId, integrationId);

    await this.prisma.$transaction(async (tx) => {
      await tx.tenantIntegration.delete({ where: { id: integrationId } });
      await this.audit(tx, actorUserId, tenantId, 'tenant.integration.deleted', { integrationId });
    });

    return { success: true };
  }

  private parseTenantInput(body: Record<string, unknown>, requireCore: boolean) {
    const enabledServices = Array.isArray(body.enabledServices)
      ? body.enabledServices.map(String).filter((key) => serviceKeys.includes(key))
      : undefined;

    const plan = this.optionalEnum(body.plan, planKeys, requireCore ? PlanKey.starter : undefined);
    const status = this.optionalEnum(body.status, tenantStatuses, requireCore ? TenantStatus.trial : undefined);

    return {
      companyName: requireCore ? this.requiredString(body.companyName, 'companyName') : this.optionalString(body.companyName),
      contactName: requireCore ? this.requiredString(body.contactName, 'contactName') : this.optionalString(body.contactName),
      email: requireCore ? this.requiredString(body.email, 'email') : this.optionalString(body.email),
      phone: this.optionalString(body.phone),
      industry: this.optionalString(body.industry),
      plan,
      status,
      seats: this.optionalNumber(body.seats, requireCore ? 1 : undefined),
      mrr: this.optionalNumber(body.mrr, requireCore ? 0 : undefined),
      trialEndsAt: typeof body.trialEndsAt === 'string' ? new Date(body.trialEndsAt) : undefined,
      notes: this.optionalString(body.notes),
      enabledServices: enabledServices ?? (requireCore ? [] : undefined),
    };
  }

  private async ensureTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');
  }

  private async ensureIntegration(tenantId: string, integrationId: string) {
    const integration = await this.prisma.tenantIntegration.findFirst({
      where: { id: integrationId, tenantId },
      select: { id: true },
    });
    if (!integration) throw new NotFoundException('Integration not found');
  }

  private requiredString(value: unknown, field: string) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${field} is required`);
    }

    return value.trim();
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' ? value.trim() : undefined;
  }

  private optionalNumber(value: unknown, fallback?: number) {
    if (value === undefined || value === null || value === '') return fallback;
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) throw new BadRequestException('Invalid number value');
    return numberValue;
  }

  private optionalBoolean(value: unknown, fallback?: boolean) {
    if (value === undefined || value === null) return fallback;
    return Boolean(value);
  }

  private optionalEnum<T extends string>(value: unknown, allowed: T[], fallback?: T) {
    if (value === undefined || value === null || value === '') return fallback;
    if (!allowed.includes(value as T)) throw new BadRequestException('Invalid enum value');
    return value as T;
  }

  private toTenantResponse(
    tenant: Prisma.TenantGetPayload<{
      include: {
        enabledServices: true;
        integrations: true;
      };
    }>,
  ) {
    return {
      ...tenant,
      enabledServices: tenant.enabledServices.map((service) => service.key),
      integrations: tenant.integrations.map((integration) => this.toIntegrationResponse(integration)),
    };
  }

  private toIntegrationResponse(integration: {
    id: string;
    platformKey: string;
    customName: string | null;
    apiKeyCipher: string;
    monthlyPrice: Prisma.Decimal;
    isActive: boolean;
    addedAt: Date;
    notes: string | null;
  }) {
    return {
      id: integration.id,
      platformKey: integration.platformKey,
      customName: integration.customName,
      apiKey: this.encryption.maskSecret(integration.apiKeyCipher),
      monthlyPrice: integration.monthlyPrice,
      isActive: integration.isActive,
      addedAt: integration.addedAt,
      notes: integration.notes,
    };
  }

  private audit(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    tenantId: string,
    event: string,
    metadata: Prisma.InputJsonValue,
  ) {
    return tx.auditLog.create({
      data: {
        actorUserId,
        tenantId,
        event,
        metadata,
      },
    });
  }
}
