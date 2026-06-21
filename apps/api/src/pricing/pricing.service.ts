import { BadRequestException, Injectable } from '@nestjs/common';
import { PlanKey, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const defaultServices = [
  { key: 'crm', label: 'CRM', description: 'Contacts, companies, and deals pipeline', icon: 'CRM', monthlyPrice: 49 },
  { key: 'email_marketing', label: 'Email Marketing', description: 'Campaigns, templates, and analytics', icon: 'EM', monthlyPrice: 99 },
  { key: 'cold_email', label: 'Cold Outreach', description: 'Sequences, prospects, mailboxes, domains, warmup, health, and auto-provisioning', icon: 'CO', monthlyPrice: 149 },
  { key: 'ai_assistant', label: 'AI Call Assistant', description: 'AI-powered sales coaching and call analysis', icon: 'AI', monthlyPrice: 199 },
  { key: 'analytics', label: 'Advanced Analytics', description: 'Custom reports and data exports', icon: 'AN', monthlyPrice: 99 },
  { key: 'api_access', label: 'API Access', description: 'REST API and webhook integrations', icon: 'API', monthlyPrice: 99 },
  { key: 'proposals', label: 'Proposals', description: 'Create, send, and track client-facing proposals', icon: 'PR', monthlyPrice: 79 },
  { key: 'finance', label: 'Finance', description: 'Invoices, payments, costs, overdue tracking, and profit reporting', icon: 'FI', monthlyPrice: 129 },
];

const defaultPlans = [
  { key: PlanKey.starter, label: 'Starter', price: 49, billingCycle: 'monthly', color: 'text-sky-700', bgColor: 'bg-sky-50', services: ['crm'] },
  { key: PlanKey.growth, label: 'Growth', price: 149, billingCycle: 'monthly', color: 'text-indigo-700', bgColor: 'bg-indigo-50', services: ['crm', 'email_marketing', 'cold_email'] },
  { key: PlanKey.business, label: 'Business', price: 299, billingCycle: 'monthly', color: 'text-violet-700', bgColor: 'bg-violet-50', services: ['crm', 'email_marketing', 'cold_email', 'ai_assistant', 'analytics', 'proposals'] },
  { key: PlanKey.enterprise, label: 'Enterprise', price: 799, billingCycle: 'monthly', color: 'text-emerald-700', bgColor: 'bg-emerald-50', services: ['crm', 'email_marketing', 'cold_email', 'ai_assistant', 'analytics', 'api_access', 'proposals', 'finance'] },
];

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async catalog() {
    await this.ensureDefaults();
    const [services, plans] = await Promise.all([
      this.prisma.serviceCatalog.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.planCatalog.findMany({ include: { services: true }, orderBy: { createdAt: 'asc' } }),
    ]);

    return {
      services: services.map((service) => ({ ...service, monthlyPrice: Number(service.monthlyPrice) })),
      plans: plans.map((plan) => ({
        ...plan,
        price: Number(plan.price),
        services: plan.services.map((service) => service.serviceKey),
      })),
    };
  }

  async upsertService(key: string, body: Record<string, unknown>) {
    await this.ensureDefaults();
    const data = {
      label: this.optionalString(body.label),
      description: this.optionalString(body.description),
      icon: this.optionalString(body.icon),
      monthlyPrice: this.optionalNumber(body.monthlyPrice),
      isActive: this.optionalBoolean(body.isActive),
    };
    const service = await this.prisma.serviceCatalog.upsert({
      where: { key },
      create: {
        key,
        label: data.label ?? key,
        description: data.description ?? '',
        icon: data.icon ?? key.slice(0, 3).toUpperCase(),
        monthlyPrice: data.monthlyPrice ?? 0,
        isActive: data.isActive ?? true,
      },
      update: data,
    });
    return { ...service, monthlyPrice: Number(service.monthlyPrice) };
  }

  async updatePlan(key: PlanKey, body: Record<string, unknown>) {
    await this.ensureDefaults();
    const services = Array.isArray(body.services) ? body.services.map(String) : undefined;
    const activeServices = services
      ? await this.prisma.serviceCatalog.findMany({ where: { key: { in: services }, isActive: true }, select: { key: true } })
      : [];
    const allowedServices = new Set(activeServices.map((service) => service.key));
    const invalidServices = services?.filter((service) => !allowedServices.has(service)) ?? [];
    if (invalidServices.length) throw new BadRequestException(`Invalid services: ${invalidServices.join(', ')}`);

    await this.prisma.$transaction(async (tx) => {
      await tx.planCatalog.update({
        where: { key },
        data: {
          label: this.optionalString(body.label),
          price: this.optionalNumber(body.price),
          billingCycle: this.optionalString(body.billingCycle),
          color: this.optionalString(body.color),
          bgColor: this.optionalString(body.bgColor),
          isActive: this.optionalBoolean(body.isActive),
        },
      });
      if (services) {
        await tx.planCatalogService.deleteMany({ where: { planKey: key } });
        if (services.length) {
          await tx.planCatalogService.createMany({
            data: services.map((serviceKey) => ({ planKey: key, serviceKey })),
          });
        }
      }
    });

    return this.catalog();
  }

  async ensureDefaults() {
    await this.prisma.$transaction(async (tx) => {
      for (const service of defaultServices) {
        await tx.serviceCatalog.upsert({
          where: { key: service.key },
          create: service,
          update: {},
        });
      }
      for (const plan of defaultPlans) {
        await tx.planCatalog.upsert({
          where: { key: plan.key },
          create: {
            key: plan.key,
            label: plan.label,
            price: plan.price,
            billingCycle: plan.billingCycle,
            color: plan.color,
            bgColor: plan.bgColor,
            services: { create: plan.services.map((serviceKey) => ({ serviceKey })) },
          },
          update: {},
        });
      }
      for (const plan of defaultPlans) {
        const existing = await tx.planCatalog.findUnique({
          where: { key: plan.key },
          include: { services: true },
        });
        if (!existing) continue;
        const existingServices = new Set(existing.services.map((service) => service.serviceKey));
        const missingServices = plan.services.filter((serviceKey) => !existingServices.has(serviceKey));
        if (missingServices.length) {
          await tx.planCatalogService.createMany({
            data: missingServices.map((serviceKey) => ({ planKey: plan.key, serviceKey })),
            skipDuplicates: true,
          });
        }
      }
    });
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' ? value.trim() : undefined;
  }

  private optionalNumber(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined;
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) throw new BadRequestException('Invalid number value');
    return new Prisma.Decimal(numberValue);
  }

  private optionalBoolean(value: unknown) {
    if (value === undefined || value === null) return undefined;
    return Boolean(value);
  }
}
