import { Injectable, Logger } from '@nestjs/common';
import { ContactStatus, DealStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CrmAutomationService {
  private readonly logger = new Logger(CrmAutomationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── #1: Auto-create Deal when Contact becomes "Prospect" ───────────────

  async onContactStatusChanged(tenantId: string, contactId: string, oldStatus: string | null, newStatus: string) {
    if (newStatus === 'prospect' && oldStatus !== 'prospect') {
      await this.autoCreateDealForProspect(tenantId, contactId);
    }

    // ── #7: Auto-push churned contacts to cold outreach ──────────────
    if (newStatus === 'churned' && oldStatus !== 'churned') {
      await this.autoCreateReEngagementProspect(tenantId, contactId);
    }
  }

  private async autoCreateDealForProspect(tenantId: string, contactId: string) {
    try {
      const contact = await this.prisma.contact.findUnique({ where: { id: contactId } });
      if (!contact) return;

      const existingDeal = await this.prisma.deal.findFirst({
        where: { tenantId, companyId: contact.companyId ?? undefined, status: 'open' },
      });
      if (existingDeal) return;

      const stages = await this.prisma.pipelineStage.findMany({
        where: { tenantId },
        orderBy: { order: 'asc' },
        take: 1,
      });
      const firstStage = stages[0]?.name ?? 'lead';

      const deal = await this.prisma.deal.create({
        data: {
          tenantId,
          title: `${contact.firstName} ${contact.lastName} — New Opportunity`,
          value: 0,
          currency: 'USD',
          stage: firstStage,
          companyId: contact.companyId,
          assignedTo: contact.assignedTo ?? '',
          status: DealStatus.open,
          probability: 20,
          interestedServices: contact.interestedServices ?? [],
        },
      });

      await this.logAutomation(tenantId, 'deal_auto_created',
        `Auto-created deal "${deal.title}" from prospect ${contact.firstName} ${contact.lastName}`,
        { contactId, dealId: deal.id, companyId: contact.companyId });

      this.logger.log(`Auto-created deal ${deal.id} for prospect ${contactId}`);
    } catch (err) {
      this.logger.warn(`Failed to auto-create deal for contact ${contactId}: ${err}`);
    }
  }

  // ── #3: Auto-advance Contact status on Deal Win ────────────────────────

  async onDealStatusChanged(tenantId: string, dealId: string, oldStatus: string | null, newStatus: string, oldStage: string | null, newStage: string | null) {
    if (newStatus === 'won' && oldStatus !== 'won') {
      await this.autoAdvanceContactsOnWin(tenantId, dealId);
    }

    // Log stage changes as activities (#5)
    if (newStage && newStage !== oldStage) {
      const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
      if (deal) {
        await this.logAutomation(tenantId, 'deal_stage_changed',
          `Deal "${deal.title}" moved from "${oldStage ?? 'none'}" to "${newStage}"`,
          { dealId, companyId: deal.companyId });
      }
    }
  }

  private async autoAdvanceContactsOnWin(tenantId: string, dealId: string) {
    try {
      const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
      if (!deal?.companyId) return;

      const contacts = await this.prisma.contact.findMany({
        where: { tenantId, companyId: deal.companyId, status: { not: ContactStatus.customer } },
      });

      for (const contact of contacts) {
        await this.prisma.contact.update({
          where: { id: contact.id },
          data: { status: ContactStatus.customer, lastActivityAt: new Date() },
        });

        await this.logAutomation(tenantId, 'contact_auto_promoted',
          `Auto-promoted ${contact.firstName} ${contact.lastName} to "customer" after deal won`,
          { contactId: contact.id, dealId, companyId: deal.companyId });
      }

      this.logger.log(`Auto-promoted ${contacts.length} contacts to customer for won deal ${dealId}`);
    } catch (err) {
      this.logger.warn(`Failed to auto-advance contacts for deal ${dealId}: ${err}`);
    }
  }

  // ── #2: Auto-generate draft Proposal when Deal enters "proposal" stage ─

  async onDealStageChanged(tenantId: string, dealId: string, oldStage: string | null, newStage: string) {
    const proposalStages = ['proposal', 'proposals'];
    if (!proposalStages.includes(newStage.toLowerCase()) || proposalStages.includes((oldStage ?? '').toLowerCase())) return;

    try {
      const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
      if (!deal) return;

      const existingProposal = await this.prisma.proposal.findFirst({
        where: { tenantId, dealId, status: { in: ['draft', 'sent'] } },
      });
      if (existingProposal) return;

      let contactName = '';
      let contactEmail = '';
      if (deal.companyId) {
        const contact = await this.prisma.contact.findFirst({
          where: { tenantId, companyId: deal.companyId },
          orderBy: { createdAt: 'asc' },
        });
        if (contact) {
          contactName = `${contact.firstName} ${contact.lastName}`;
          contactEmail = contact.email;
        }
      }

      const company = deal.companyId
        ? await this.prisma.company.findUnique({ where: { id: deal.companyId } })
        : null;

      const proposal = await this.prisma.proposal.create({
        data: {
          tenantId,
          scope: 'client',
          createdByType: 'client',
          recipientType: 'customer',
          proposalNumber: `AUTO-${Date.now()}`,
          title: `Proposal for ${deal.title}`,
          recipientName: contactName || company?.name || '',
          recipientEmail: contactEmail,
          companyName: company?.name,
          companyId: deal.companyId,
          dealId: deal.id,
          status: 'draft',
          createdBy: 'system',
          subtotal: deal.value,
          total: deal.value,
          trackingToken: crypto.randomUUID(),
        },
      });

      await this.logAutomation(tenantId, 'proposal_auto_created',
        `Auto-created draft proposal "${proposal.title}" for deal "${deal.title}"`,
        { dealId, companyId: deal.companyId });

      this.logger.log(`Auto-created draft proposal ${proposal.id} for deal ${dealId}`);
    } catch (err) {
      this.logger.warn(`Failed to auto-create proposal for deal ${dealId}: ${err}`);
    }
  }

  // ── #4: Stale Deal Detection ───────────────────────────────────────────

  async getStaleDeals(tenantId: string, staleDays = 14) {
    const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);

    const staleDeals = await this.prisma.deal.findMany({
      where: {
        tenantId,
        status: DealStatus.open,
        updatedAt: { lt: cutoff },
      },
      orderBy: { updatedAt: 'asc' },
    });

    return staleDeals.map(deal => ({
      ...deal,
      daysSinceUpdate: Math.floor((Date.now() - deal.updatedAt.getTime()) / (24 * 60 * 60 * 1000)),
    }));
  }

  // ── #5: Auto-log Activities (called from various hooks) ────────────────

  async onProposalSent(tenantId: string, proposalId: string) {
    try {
      const proposal = await this.prisma.proposal.findUnique({ where: { id: proposalId } });
      if (!proposal) return;

      await this.logAutomation(tenantId, 'proposal_sent',
        `Proposal "${proposal.title}" sent to ${proposal.recipientName || proposal.recipientEmail}`,
        { dealId: proposal.dealId, companyId: proposal.companyId, contactId: proposal.contactId });
    } catch {}
  }

  async onProposalViewed(tenantId: string, proposalId: string) {
    try {
      const proposal = await this.prisma.proposal.findUnique({ where: { id: proposalId } });
      if (!proposal) return;

      await this.logAutomation(tenantId, 'proposal_viewed',
        `Proposal "${proposal.title}" was viewed by ${proposal.recipientName || 'recipient'}`,
        { dealId: proposal.dealId, companyId: proposal.companyId, contactId: proposal.contactId });
    } catch {}
  }

  async onProposalAccepted(tenantId: string, proposalId: string) {
    try {
      const proposal = await this.prisma.proposal.findUnique({ where: { id: proposalId } });
      if (!proposal) return;

      await this.logAutomation(tenantId, 'proposal_accepted',
        `Proposal "${proposal.title}" was accepted`,
        { dealId: proposal.dealId, companyId: proposal.companyId, contactId: proposal.contactId });

      // If linked to a deal, auto-advance deal to "won"
      if (proposal.dealId) {
        const deal = await this.prisma.deal.findUnique({ where: { id: proposal.dealId } });
        if (deal && deal.status === 'open') {
          await this.prisma.deal.update({
            where: { id: deal.id },
            data: { status: DealStatus.won },
          });
          await this.onDealStatusChanged(tenantId, deal.id, 'open', 'won', deal.stage, deal.stage);
        }
      }
    } catch {}
  }

  // ── #6: Proposal Follow-up Reminders ───────────────────────────────────

  async getProposalFollowUps(tenantId: string) {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [notViewed, notAccepted] = await Promise.all([
      this.prisma.proposal.findMany({
        where: {
          tenantId,
          status: 'sent',
          updatedAt: { lt: threeDaysAgo },
        },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.proposal.findMany({
        where: {
          tenantId,
          status: 'viewed',
          updatedAt: { lt: sevenDaysAgo },
        },
        orderBy: { updatedAt: 'asc' },
      }),
    ]);

    return {
      notViewed: notViewed.map(p => ({
        ...p,
        daysSinceSent: Math.floor((Date.now() - p.updatedAt.getTime()) / (24 * 60 * 60 * 1000)),
        reminderType: 'not_viewed' as const,
      })),
      notAccepted: notAccepted.map(p => ({
        ...p,
        daysSinceViewed: Math.floor((Date.now() - p.updatedAt.getTime()) / (24 * 60 * 60 * 1000)),
        reminderType: 'not_accepted' as const,
      })),
    };
  }

  // ── #7: Contact-to-Cold-Outreach for Churned ──────────────────────────

  private async autoCreateReEngagementProspect(tenantId: string, contactId: string) {
    try {
      const contact = await this.prisma.contact.findUnique({ where: { id: contactId } });
      if (!contact) return;

      const existingProspect = await this.prisma.coldProspect.findFirst({
        where: { email: contact.email },
      });
      if (existingProspect) return;

      let list = await this.prisma.coldProspectList.findFirst({
        where: { tenantId, name: 'Re-engagement (Auto)' },
      });
      if (!list) {
        list = await this.prisma.coldProspectList.create({
          data: { tenantId, name: 'Re-engagement (Auto)', totalCount: 0, createdBy: 'system' },
        });
      }

      await this.prisma.coldProspect.create({
        data: {
          listId: list.id,
          email: contact.email,
          firstName: contact.firstName,
          lastName: contact.lastName,
          companyName: null,
          jobTitle: contact.jobTitle,
        },
      });

      await this.prisma.coldProspectList.update({
        where: { id: list.id },
        data: { totalCount: { increment: 1 } },
      });

      await this.logAutomation(tenantId, 'contact_auto_reengagement',
        `Auto-added churned contact ${contact.firstName} ${contact.lastName} to re-engagement list`,
        { contactId });

      this.logger.log(`Auto-added churned contact ${contactId} to re-engagement prospect list`);
    } catch (err) {
      this.logger.warn(`Failed to add churned contact ${contactId} to re-engagement: ${err}`);
    }
  }

  // ── #8: Deal Value Forecasting ─────────────────────────────────────────

  async getDealForecast(tenantId: string) {
    const openDeals = await this.prisma.deal.findMany({
      where: { tenantId, status: DealStatus.open },
    });

    const totalPipeline = openDeals.reduce((sum, d) => sum + Number(d.value), 0);
    const weightedPipeline = openDeals.reduce((sum, d) => sum + Number(d.value) * (d.probability / 100), 0);

    const byStage = new Map<string, { count: number; value: number; weighted: number }>();
    for (const deal of openDeals) {
      const current = byStage.get(deal.stage) ?? { count: 0, value: 0, weighted: 0 };
      current.count += 1;
      current.value += Number(deal.value);
      current.weighted += Number(deal.value) * (deal.probability / 100);
      byStage.set(deal.stage, current);
    }

    const wonThisMonth = await this.prisma.deal.findMany({
      where: {
        tenantId,
        status: DealStatus.won,
        updatedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    });
    const wonValue = wonThisMonth.reduce((sum, d) => sum + Number(d.value), 0);

    return {
      totalPipeline,
      weightedPipeline: Math.round(weightedPipeline * 100) / 100,
      dealCount: openDeals.length,
      avgDealValue: openDeals.length ? Math.round(totalPipeline / openDeals.length) : 0,
      avgProbability: openDeals.length ? Math.round(openDeals.reduce((s, d) => s + d.probability, 0) / openDeals.length) : 0,
      wonThisMonth: wonThisMonth.length,
      wonValue,
      byStage: Array.from(byStage.entries()).map(([stage, data]) => ({ stage, ...data })),
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private logAutomation(tenantId: string, type: string, subject: string, links: { contactId?: string | null; companyId?: string | null; dealId?: string | null }) {
    return this.prisma.activity.create({
      data: {
        tenantId,
        type,
        subject,
        contactId: links.contactId ?? undefined,
        companyId: links.companyId ?? undefined,
        dealId: links.dealId ?? undefined,
        createdBy: 'system',
      },
    }).catch(() => {});
  }
}
