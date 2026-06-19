import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService) {}

  listSessions(tenantId: string, userId: string) {
    return this.prisma.aiSession.findMany({ where: { tenantId, userId }, orderBy: { updatedAt: 'desc' } });
  }

  createSession(tenantId: string, userId: string, body: Record<string, unknown>) {
    return this.prisma.aiSession.create({
      data: {
        tenantId,
        userId,
        title: typeof body.title === 'string' ? body.title : 'AI Assistant',
      },
    });
  }

  async listMessages(tenantId: string, userId: string, sessionId: string) {
    await this.ensureSession(tenantId, userId, sessionId);
    return this.prisma.aiMessage.findMany({ where: { sessionId }, orderBy: { timestamp: 'asc' } });
  }

  async chat(tenantId: string, userId: string, body: Record<string, unknown>) {
    const content = this.requiredString(body.message ?? body.content, 'message');
    const session = body.sessionId
      ? await this.ensureSession(tenantId, userId, String(body.sessionId))
      : await this.prisma.aiSession.create({ data: { tenantId, userId, title: content.slice(0, 60) } });

    const [deals, contacts, campaigns] = await Promise.all([
      this.prisma.deal.findMany({ where: { tenantId, status: 'open' }, orderBy: { value: 'desc' }, take: 5 }),
      this.prisma.contact.count({ where: { tenantId } }),
      this.prisma.emailCampaign.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 3 }),
    ]);

    const response = this.localResponse(content, {
      openDeals: deals.map((deal) => ({ title: deal.title, value: Number(deal.value), stage: deal.stage, probability: deal.probability })),
      contactCount: contacts,
      campaignCount: campaigns.length,
    });

    await this.prisma.$transaction([
      this.prisma.aiMessage.create({ data: { sessionId: session.id, role: 'user', content } }),
      this.prisma.aiMessage.create({ data: { sessionId: session.id, role: 'assistant', content: response } }),
      this.prisma.aiUsageEvent.create({ data: { tenantId, userId, sessionId: session.id, action: 'chat', model: 'local-context', tokens: Math.ceil((content.length + response.length) / 4) } }),
      this.prisma.aiSession.update({ where: { id: session.id }, data: { updatedAt: new Date() } }),
    ]);

    return { sessionId: session.id, message: { role: 'assistant', content: response, timestamp: new Date().toISOString() } };
  }

  async generateEmail(tenantId: string, userId: string, body: Record<string, unknown>) {
    const goal = this.requiredString(body.goal ?? body.prompt, 'goal');
    const contacts = await this.prisma.contact.findMany({ where: { tenantId }, take: 1 });
    const firstName = contacts[0]?.firstName ?? '[First Name]';
    const content = `Subject: Following up on ${goal}\n\nHi ${firstName},\n\nI wanted to follow up with a quick note about ${goal}. Based on our recent conversation, your team can keep CRM, campaigns, and sales insights in one place.\n\nWould you be open to a 20-minute call this week to discuss next steps?\n\nBest,\nYour team`;
    await this.prisma.aiUsageEvent.create({ data: { tenantId, userId, action: 'generate_email', model: 'local-template', tokens: Math.ceil(content.length / 4) } });
    return { content };
  }

  async dailySummary(tenantId: string, userId: string) {
    const [openDeals, contacts, sentCampaigns] = await Promise.all([
      this.prisma.deal.findMany({ where: { tenantId, status: 'open' } }),
      this.prisma.contact.count({ where: { tenantId } }),
      this.prisma.emailCampaign.findMany({ where: { tenantId, status: 'sent' } }),
    ]);
    const pipelineValue = openDeals.reduce((sum, deal) => sum + Number(deal.value), 0);
    const summary = {
      date: new Date().toISOString(),
      pipeline: { openDeals: openDeals.length, value: pipelineValue },
      contacts,
      campaigns: { sent: sentCampaigns.length },
      priorities: [
        'Follow up on high-probability open deals',
        'Review recent campaign engagement',
        'Add next activities for deals without recent movement',
      ],
    };
    await this.prisma.aiUsageEvent.create({ data: { tenantId, userId, action: 'daily_summary', model: 'local-summary', tokens: 120 } });
    return summary;
  }

  private async ensureSession(tenantId: string, userId: string, sessionId: string) {
    const session = await this.prisma.aiSession.findFirst({ where: { id: sessionId, tenantId, userId } });
    if (!session) throw new NotFoundException('AI session not found');
    return session;
  }

  private localResponse(message: string, context: { openDeals: Array<{ title: string; value: number; stage: string; probability: number }>; contactCount: number; campaignCount: number }) {
    const lower = message.toLowerCase();
    if (lower.includes('pipeline') || lower.includes('deal')) {
      const value = context.openDeals.reduce((sum, deal) => sum + deal.value, 0);
      const lines = context.openDeals.map((deal) => `- ${deal.title}: $${deal.value.toLocaleString()} (${deal.stage}, ${deal.probability}%)`).join('\n');
      return `You have ${context.openDeals.length} open deals worth $${value.toLocaleString()}.\n\n${lines || 'No open deals yet.'}\n\nTop action: focus on the highest probability deal and log a next activity.`;
    }
    if (lower.includes('summary')) {
      return `Daily summary: ${context.contactCount} contacts, ${context.openDeals.length} open deals, and ${context.campaignCount} recent campaigns. Priority: keep deal follow-ups current and use campaign engagement as a signal.`;
    }
    if (lower.includes('email')) {
      return 'Here is a concise follow-up structure: thank them for the conversation, restate the business outcome, include one concrete next step, and ask for a specific meeting window.';
    }
    return 'I can help with pipeline analysis, follow-up emails, deal prioritization, and daily sales summaries using your tenant-scoped CRM data.';
  }

  private requiredString(value: unknown, field: string) {
    if (typeof value !== 'string' || value.trim().length === 0) throw new BadRequestException(`${field} is required`);
    return value.trim();
  }
}
