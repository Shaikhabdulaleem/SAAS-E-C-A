import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminAlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async listRules() {
    return this.prisma.alertRule.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createRule(data: { name: string; description?: string; metric: string; operator: string; threshold: number; severity?: string; notifyAdmin?: boolean }) {
    return this.prisma.alertRule.create({
      data: {
        name: data.name,
        description: data.description,
        metric: data.metric,
        operator: data.operator,
        threshold: data.threshold,
        severity: data.severity ?? 'warning',
        notifyAdmin: data.notifyAdmin ?? true,
      },
    });
  }

  async updateRule(id: string, data: Record<string, unknown>) {
    const rule = await this.prisma.alertRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Alert rule not found');
    return this.prisma.alertRule.update({
      where: { id },
      data: {
        name: data.name ? String(data.name) : undefined,
        description: data.description !== undefined ? String(data.description) : undefined,
        metric: data.metric ? String(data.metric) : undefined,
        operator: data.operator ? String(data.operator) : undefined,
        threshold: data.threshold !== undefined ? Number(data.threshold) : undefined,
        severity: data.severity ? String(data.severity) : undefined,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined,
        notifyAdmin: data.notifyAdmin !== undefined ? Boolean(data.notifyAdmin) : undefined,
      },
    });
  }

  async removeRule(id: string) {
    const rule = await this.prisma.alertRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Alert rule not found');
    await this.prisma.alertRule.delete({ where: { id } });
    return { success: true };
  }

  async evaluate() {
    const rules = await this.prisma.alertRule.findMany({ where: { isActive: true } });
    if (rules.length === 0) return { evaluated: 0, triggered: 0, alerts: [] };

    const tenants = await this.prisma.tenant.findMany({
      where: { status: { in: [TenantStatus.active, TenantStatus.trial, TenantStatus.payment_failed] } },
      select: { id: true, companyName: true, status: true },
    });

    const alerts: Array<{ ruleId: string; tenantId: string; severity: string; message: string }> = [];

    for (const rule of rules) {
      for (const tenant of tenants) {
        const value = await this.getMetricValue(rule.metric, tenant.id, tenant.status);
        if (value === null) continue;

        const triggered = this.checkThreshold(value, rule.operator, rule.threshold);
        if (triggered) {
          alerts.push({
            ruleId: rule.id,
            tenantId: tenant.id,
            severity: rule.severity,
            message: `${tenant.companyName}: ${rule.name} — ${rule.metric} is ${value} (threshold: ${rule.operator} ${rule.threshold})`,
          });
        }
      }
    }

    if (alerts.length > 0) {
      await this.prisma.alertEvent.createMany({
        data: alerts.map(a => ({
          ruleId: a.ruleId,
          tenantId: a.tenantId,
          severity: a.severity,
          message: a.message,
        })),
      });
    }

    return { evaluated: rules.length * tenants.length, triggered: alerts.length, alerts };
  }

  async listEvents(query: Record<string, string>) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 25), 1), 100);
    const where: Prisma.AlertEventWhereInput = {};
    if (query.severity) where.severity = query.severity;
    if (query.resolved === 'true') where.resolvedAt = { not: null };
    if (query.resolved === 'false') where.resolvedAt = null;

    const [items, total] = await Promise.all([
      this.prisma.alertEvent.findMany({
        where,
        include: { rule: { select: { name: true, metric: true } }, tenant: { select: { companyName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.alertEvent.count({ where }),
    ]);

    return { items, pagination: { page, pageSize, total } };
  }

  async resolveEvent(id: string) {
    const event = await this.prisma.alertEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Alert event not found');
    return this.prisma.alertEvent.update({ where: { id }, data: { resolvedAt: new Date() } });
  }

  private async getMetricValue(metric: string, tenantId: string, status: string): Promise<number | null> {
    switch (metric) {
      case 'health_score': {
        const sessions = await this.prisma.session.count({
          where: { user: { memberships: { some: { tenantId } } }, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        });
        return sessions > 0 ? 70 : 20;
      }
      case 'login_recency': {
        const last = await this.prisma.session.findFirst({
          where: { user: { memberships: { some: { tenantId } } } },
          orderBy: { createdAt: 'desc' },
        });
        if (!last) return 999;
        return Math.floor((Date.now() - last.createdAt.getTime()) / (24 * 60 * 60 * 1000));
      }
      case 'payment_status':
        return status === 'payment_failed' ? 1 : 0;
      case 'domain_health': {
        const domains = await this.prisma.sendingDomain.findMany({ where: { tenantId }, select: { healthScore: true } });
        if (domains.length === 0) return null;
        return Math.round(domains.reduce((s, d) => s + d.healthScore, 0) / domains.length);
      }
      default:
        return null;
    }
  }

  private checkThreshold(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'lt': return value < threshold;
      case 'gt': return value > threshold;
      case 'lte': return value <= threshold;
      case 'gte': return value >= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }
}
