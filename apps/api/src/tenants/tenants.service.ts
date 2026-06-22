import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { InviteStatus, PlanKey, Prisma, TenantMemberRole, TenantStatus, UserRole } from '@prisma/client';
import { PasswordService } from '../auth/password.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from './encryption.service';

const serviceKeys = ['crm', 'email_marketing', 'cold_email', 'ai_assistant', 'analytics', 'api_access', 'proposals', 'finance'];
const planKeys = Object.values(PlanKey);
const tenantStatuses = Object.values(TenantStatus);

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly passwords: PasswordService,
  ) {}

  async list(query: Record<string, string> = {}) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 20), 1), 100);
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = (query.sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';

    const allowedSortFields = ['companyName', 'mrr', 'createdAt', 'status', 'seats', 'plan'];
    const orderField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const where: any = {};
    if (query.search) {
      where.OR = [
        { companyName: { contains: query.search, mode: 'insensitive' } },
        { contactName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.status && query.status !== 'all') {
      where.status = query.status;
    }

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        include: { enabledServices: true, integrations: true },
        orderBy: { [orderField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      items: tenants.map((tenant) => this.toTenantResponse(tenant)),
      pagination: { page, pageSize, total },
    };
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
    const mrr = data.status === TenantStatus.active ? await this.calculateMrr(data.plan ?? PlanKey.starter, data) : data.mrr ?? 0;

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
          mrr,
          customPriceEnabled: data.customPriceEnabled ?? false,
          customMrr: data.customMrr,
          discountType: data.discountType ?? 'none',
          discountValue: data.discountValue ?? 0,
          discountReason: data.discountReason,
          discountExpiresAt: data.discountExpiresAt,
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
    const current = await this.ensureTenant(tenantId);
    const data = this.parseTenantInput(body, false);
    const priceAffectingFields = ['plan', 'status', 'customPriceEnabled', 'customMrr', 'discountType', 'discountValue', 'discountExpiresAt', 'mrr'];
    const shouldRecalculateMrr = priceAffectingFields.some((field) => Object.prototype.hasOwnProperty.call(body, field));
    const merged = {
      plan: data.plan ?? current.plan,
      status: data.status ?? current.status,
      customPriceEnabled: data.customPriceEnabled ?? current.customPriceEnabled,
      customMrr: data.customMrr ?? (current.customMrr ? Number(current.customMrr) : undefined),
      discountType: data.discountType ?? current.discountType,
      discountValue: data.discountValue ?? Number(current.discountValue),
      discountExpiresAt: data.discountExpiresAt ?? current.discountExpiresAt ?? undefined,
    };
    const nextMrr = shouldRecalculateMrr
      ? merged.status === TenantStatus.active
        ? await this.calculateMrr(merged.plan, merged)
        : 0
      : data.mrr;

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
          mrr: nextMrr,
          customPriceEnabled: data.customPriceEnabled,
          customMrr: data.customMrr,
          discountType: data.discountType,
          discountValue: data.discountValue,
          discountReason: data.discountReason,
          discountExpiresAt: data.discountExpiresAt,
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

  async bulkAction(
    ids: string[],
    action: string,
    params: Record<string, unknown>,
    actorUserId: string,
  ) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('No tenant IDs provided');
    }

    const validActions = ['activate', 'suspend', 'cancel', 'delete', 'change_plan'];
    if (!validActions.includes(action)) {
      throw new BadRequestException('Invalid bulk action');
    }

    let affected = 0;

    await this.prisma.$transaction(async (tx) => {
      if (action === 'delete') {
        const result = await tx.tenant.deleteMany({ where: { id: { in: ids } } });
        affected = result.count;
      } else if (action === 'activate') {
        const result = await tx.tenant.updateMany({
          where: { id: { in: ids } },
          data: { status: TenantStatus.active },
        });
        affected = result.count;
      } else if (action === 'suspend') {
        const result = await tx.tenant.updateMany({
          where: { id: { in: ids } },
          data: { status: TenantStatus.suspended, mrr: 0 },
        });
        affected = result.count;
      } else if (action === 'cancel') {
        const result = await tx.tenant.updateMany({
          where: { id: { in: ids } },
          data: { status: TenantStatus.cancelled, mrr: 0 },
        });
        affected = result.count;
      } else if (action === 'change_plan') {
        const plan = this.optionalEnum(params.plan, planKeys);
        if (!plan) throw new BadRequestException('Plan is required for change_plan action');
        const result = await tx.tenant.updateMany({
          where: { id: { in: ids } },
          data: { plan: plan as PlanKey },
        });
        affected = result.count;
      }

      await this.audit(tx, actorUserId, null as unknown as string, 'tenant.bulk_action', {
        action,
        ids,
        affected,
        params,
      });
    });

    return { affected };
  }

  async remove(tenantId: string, actorUserId: string) {
    await this.ensureTenant(tenantId);

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.delete({ where: { id: tenantId } });
      await this.audit(tx, actorUserId, tenantId, 'tenant.deleted', {});
    });

    return { success: true };
  }

  async getAccess(tenantId: string) {
    const tenant = await this.getTenantWithServices(tenantId);
    const [members, invites, lastInvite, lastReset] = await Promise.all([
      this.prisma.tenantUser.findMany({
        where: { tenantId },
        include: { user: { select: { id: true, name: true, email: true, initials: true, createdAt: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.tenantInvite.findMany({
        where: { tenantId, status: InviteStatus.pending },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.findFirst({ where: { tenantId, event: 'tenant.access.invite_created' }, orderBy: { createdAt: 'desc' } }),
      this.prisma.auditLog.findFirst({ where: { tenantId, event: 'tenant.access.password_reset' }, orderBy: { createdAt: 'desc' } }),
    ]);
    const owner = members.find((member) => member.role === TenantMemberRole.owner) ?? null;
    return {
      tenantId,
      owner,
      members,
      pendingInvites: invites,
      loginUrl: this.loginUrl(),
      inviteUrl: null,
      email: tenant.email,
      enabledServices: tenant.enabledServices.map((service) => service.key),
      lastInviteAt: lastInvite?.createdAt ?? null,
      lastResetAt: lastReset?.createdAt ?? null,
    };
  }

  async inviteOwner(tenantId: string, actorUserId: string) {
    const tenant = await this.getTenantWithServices(tenantId);
    await this.enforceSeatLimitForNewMember(tenantId, tenant.email);
    const token = randomBytes(32).toString('hex');
    const existing = await this.prisma.tenantInvite.findFirst({
      where: { tenantId, email: tenant.email.toLowerCase(), status: InviteStatus.pending },
    });
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    const invite = existing
      ? await this.prisma.tenantInvite.update({
          where: { id: existing.id },
          data: { role: TenantMemberRole.owner, tokenHash: this.hash(token), expiresAt },
        })
      : await this.prisma.tenantInvite.create({
          data: {
            tenantId,
            email: tenant.email.toLowerCase(),
            role: TenantMemberRole.owner,
            tokenHash: this.hash(token),
            invitedByUserId: actorUserId,
            expiresAt,
          },
        });
    await this.audit(this.prisma, actorUserId, tenantId, 'tenant.access.invite_created', { inviteId: invite.id, email: invite.email });
    return {
      invite,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      inviteUrl: this.inviteUrl(token),
      loginUrl: this.loginUrl(),
    };
  }

  async createOwnerLogin(tenantId: string, actorUserId: string) {
    const tenant = await this.getTenantWithServices(tenantId);
    await this.enforceSeatLimitForNewMember(tenantId, tenant.email);
    const temporaryPassword = this.generateTemporaryPassword();
    const user = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: tenant.email.toLowerCase() } });
      if (existing?.role === UserRole.superadmin) throw new BadRequestException('Tenant contact email belongs to a superadmin account');
      const savedUser = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              name: tenant.contactName,
              passwordHash: await this.passwords.hash(temporaryPassword),
              role: UserRole.client,
              initials: this.initials(tenant.contactName),
              tenantId,
              tenantName: tenant.companyName,
            },
          })
        : await tx.user.create({
            data: {
              name: tenant.contactName,
              email: tenant.email.toLowerCase(),
              passwordHash: await this.passwords.hash(temporaryPassword),
              role: UserRole.client,
              initials: this.initials(tenant.contactName),
              tenantId,
              tenantName: tenant.companyName,
            },
          });
      await tx.tenantUser.upsert({
        where: { tenantId_userId: { tenantId, userId: savedUser.id } },
        create: { tenantId, userId: savedUser.id, role: TenantMemberRole.owner },
        update: { role: TenantMemberRole.owner },
      });
      await tx.refreshToken.updateMany({ where: { userId: savedUser.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit(tx, actorUserId, tenantId, 'tenant.access.owner_created', { userId: savedUser.id, email: savedUser.email });
      return savedUser;
    });
    return this.ownerLoginResponse(tenant, user.email, temporaryPassword);
  }

  async resetOwnerPassword(tenantId: string, actorUserId: string) {
    const tenant = await this.getTenantWithServices(tenantId);
    const owner = await this.findOwnerUser(tenantId, tenant.email);
    if (!owner) throw new NotFoundException('Owner login has not been created yet');
    const temporaryPassword = this.generateTemporaryPassword();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: owner.id },
        data: { passwordHash: await this.passwords.hash(temporaryPassword), tenantId, tenantName: tenant.companyName },
      });
      await tx.refreshToken.updateMany({ where: { userId: owner.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit(tx, actorUserId, tenantId, 'tenant.access.password_reset', { userId: owner.id, email: owner.email });
    });
    return this.ownerLoginResponse(tenant, owner.email, temporaryPassword);
  }

  async loginDetails(tenantId: string, actorUserId: string) {
    const tenant = await this.getTenantWithServices(tenantId);
    await this.audit(this.prisma, actorUserId, tenantId, 'tenant.access.login_details_copied', { email: tenant.email.toLowerCase() });
    return {
      loginUrl: this.loginUrl(),
      email: tenant.email.toLowerCase(),
      role: TenantMemberRole.owner,
      tenantName: tenant.companyName,
      enabledServices: tenant.enabledServices.map((service) => service.key),
    };
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
      customPriceEnabled: this.optionalBoolean(body.customPriceEnabled),
      customMrr: this.optionalNumber(body.customMrr),
      discountType: this.optionalDiscountType(body.discountType),
      discountValue: this.optionalNumber(body.discountValue, requireCore ? 0 : undefined),
      discountReason: this.optionalString(body.discountReason),
      discountExpiresAt: this.optionalDate(body.discountExpiresAt),
      trialEndsAt: typeof body.trialEndsAt === 'string' ? new Date(body.trialEndsAt) : undefined,
      notes: this.optionalString(body.notes),
      enabledServices: enabledServices ?? (requireCore ? [] : undefined),
    };
  }

  private async ensureTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  private async getTenantWithServices(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { enabledServices: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  private async findOwnerUser(tenantId: string, email: string) {
    const owner = await this.prisma.tenantUser.findFirst({
      where: { tenantId, role: TenantMemberRole.owner },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    if (owner) return owner.user;
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  private async enforceSeatLimitForNewMember(tenantId: string, email: string) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      const membership = await this.prisma.tenantUser.findUnique({ where: { tenantId_userId: { tenantId, userId: existingUser.id } } });
      if (membership) return;
    }
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { seats: true } });
    const memberCount = await this.prisma.tenantUser.count({ where: { tenantId } });
    if (tenant && memberCount >= tenant.seats) throw new BadRequestException('Seat limit reached');
  }

  private ownerLoginResponse(
    tenant: { companyName: string; enabledServices: Array<{ key: string }> },
    email: string,
    temporaryPassword: string,
  ) {
    return {
      loginUrl: this.loginUrl(),
      email: email.toLowerCase(),
      temporaryPassword,
      role: TenantMemberRole.owner,
      tenantName: tenant.companyName,
      enabledServices: tenant.enabledServices.map((service) => service.key),
      oneTimePassword: true,
    };
  }

  private inviteUrl(token: string) {
    return `${this.portalBaseUrl()}/invite/${token}`;
  }

  private loginUrl() {
    return `${this.portalBaseUrl()}/login`;
  }

  private portalBaseUrl() {
    const configured = process.env.APP_URL || process.env.FRONTEND_URL;
    if (configured) return configured.replace(/\/$/, '');
    const corsOrigin = process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim()).find(Boolean);
    return (corsOrigin || 'http://localhost:5173').replace(/\/$/, '');
  }

  private initials(name: string) {
    return name.trim().split(/\s+/).map((part) => part[0]?.toUpperCase()).join('').slice(0, 2) || 'U';
  }

  private generateTemporaryPassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    return Array.from({ length: 16 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
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

  private optionalDate(value: unknown) {
    if (typeof value !== 'string' || !value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date value');
    return date;
  }

  private optionalDiscountType(value: unknown) {
    const allowed = ['none', 'percent', 'fixed'];
    if (value === undefined || value === null || value === '') return undefined;
    if (!allowed.includes(String(value))) throw new BadRequestException('Invalid discount type');
    return String(value);
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

  private async calculateMrr(
    plan: PlanKey,
    values: {
      customPriceEnabled?: boolean;
      customMrr?: number | Prisma.Decimal;
      discountType?: string;
      discountValue?: number | Prisma.Decimal;
      discountExpiresAt?: Date | null;
    },
  ) {
    if (values.customPriceEnabled) {
      return Math.max(0, Number(values.customMrr ?? 0));
    }

    const planCatalog = await this.prisma.planCatalog.findUnique({ where: { key: plan }, select: { price: true } });
    let total = Number(planCatalog?.price ?? this.defaultPlanPrice(plan));
    const discountExpired = values.discountExpiresAt ? values.discountExpiresAt.getTime() < Date.now() : false;
    if (!discountExpired) {
      const discountValue = Number(values.discountValue ?? 0);
      if (values.discountType === 'percent') total -= total * Math.min(Math.max(discountValue, 0), 100) / 100;
      if (values.discountType === 'fixed') total -= Math.max(discountValue, 0);
    }
    return Math.max(0, Math.round(total * 100) / 100);
  }

  private defaultPlanPrice(plan: PlanKey) {
    const prices: Record<PlanKey, number> = {
      [PlanKey.starter]: 49,
      [PlanKey.growth]: 149,
      [PlanKey.business]: 299,
      [PlanKey.enterprise]: 799,
    };
    return prices[plan];
  }

  private audit(
    tx: Prisma.TransactionClient | PrismaService,
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
