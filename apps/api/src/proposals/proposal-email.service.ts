import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailDeliveryService } from '../providers/services/email-delivery.service';
import { BrandingService, type BrandConfig } from './branding.service';
import { ProposalActivityService } from './proposal-activity.service';

@Injectable()
export class ProposalEmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailDelivery: EmailDeliveryService,
    private readonly branding: BrandingService,
    private readonly activity: ProposalActivityService,
  ) {}

  async sendProposal(proposalId: string, options: {
    toEmail: string;
    ccEmail?: string;
    subject: string;
    message: string;
    actorId: string;
    actorType: string;
    baseUrl: string;
  }) {
    const proposal = await this.prisma.proposal.findUniqueOrThrow({
      where: { id: proposalId },
      include: { services: true },
    });

    const brand = await this.branding.resolve(proposal.createdByType, proposal.tenantId ?? undefined);
    const viewUrl = `${options.baseUrl}/proposals/view/${proposal.trackingToken}`;

    const html = this.buildProposalEmail(proposal, brand, options.message, viewUrl);

    const fromEmail = brand.contactEmail ?? 'noreply@nexushq.com';
    const fromName = brand.companyName;

    await this.emailDelivery.send({
      tenantId: proposal.tenantId ?? 'system',
      to: options.toEmail,
      fromEmail,
      fromName,
      subject: options.subject,
      html,
      trackingArgs: { proposalId, type: 'proposal' },
    });

    await this.prisma.proposal.update({
      where: { id: proposalId },
      data: { status: 'sent', sentAt: new Date() },
    });

    await this.activity.log({
      proposalId,
      eventType: 'sent',
      actorType: options.actorType,
      actorId: options.actorId,
      metadata: { toEmail: options.toEmail, subject: options.subject },
    });

    return { success: true };
  }

  async sendFollowUp(proposalId: string, baseUrl: string) {
    const proposal = await this.prisma.proposal.findUniqueOrThrow({
      where: { id: proposalId },
    });

    if (proposal.status !== 'sent') return { skipped: true };

    const brand = await this.branding.resolve(proposal.createdByType, proposal.tenantId ?? undefined);
    const viewUrl = `${baseUrl}/proposals/view/${proposal.trackingToken}`;

    const html = this.buildFollowUpEmail(proposal, brand, viewUrl);
    const fromEmail = brand.contactEmail ?? 'noreply@nexushq.com';

    await this.emailDelivery.send({
      tenantId: proposal.tenantId ?? 'system',
      to: proposal.recipientEmail!,
      fromEmail,
      fromName: brand.companyName,
      subject: `Follow-up: ${proposal.title}`,
      html,
      trackingArgs: { proposalId, type: 'proposal_followup' },
    });

    await this.activity.log({
      proposalId,
      eventType: 'follow_up_sent',
      actorType: 'system',
      metadata: { toEmail: proposal.recipientEmail },
    });

    return { success: true };
  }

  private buildProposalEmail(proposal: any, brand: BrandConfig, message: string, viewUrl: string): string {
    const serviceList = proposal.services?.map((s: any) =>
      `<li style="padding:4px 0;">${s.serviceType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} — ${s.planName}</li>`
    ).join('') ?? '';

    return `
      <div style="font-family:'${brand.fontFamily}',sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
        <div style="padding:24px;border-bottom:3px solid ${brand.primaryColor};">
          ${brand.logoUrl ? `<img src="${brand.logoUrl}" alt="${brand.companyName}" style="max-height:40px;" />` : `<div style="font-size:20px;font-weight:700;color:${brand.primaryColor};">${brand.companyName}</div>`}
        </div>
        <div style="padding:24px;">
          <p style="font-size:16px;">Dear ${proposal.recipientName},</p>
          <p>${message}</p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:20px 0;">
            <h3 style="margin:0 0 12px;font-size:14px;color:${brand.primaryColor};">Proposal Summary</h3>
            ${serviceList ? `<ul style="list-style:none;padding:0;margin:0 0 12px;">${serviceList}</ul>` : ''}
            <p style="font-size:18px;font-weight:700;color:${brand.primaryColor};margin:0;">Total: $${Number(proposal.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="${viewUrl}" style="display:inline-block;background:${brand.primaryColor};color:white;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">View Your Proposal</a>
          </div>
        </div>
        <div style="padding:16px 24px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;">
          <p>${brand.companyName}</p>
          ${brand.contactEmail ? `<p>${brand.contactEmail}</p>` : ''}
          ${brand.contactPhone ? `<p>${brand.contactPhone}</p>` : ''}
        </div>
      </div>`;
  }

  private buildFollowUpEmail(proposal: any, brand: BrandConfig, viewUrl: string): string {
    return `
      <div style="font-family:'${brand.fontFamily}',sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
        <div style="padding:24px;border-bottom:3px solid ${brand.primaryColor};">
          ${brand.logoUrl ? `<img src="${brand.logoUrl}" alt="${brand.companyName}" style="max-height:40px;" />` : `<div style="font-size:20px;font-weight:700;color:${brand.primaryColor};">${brand.companyName}</div>`}
        </div>
        <div style="padding:24px;">
          <p>Hi ${proposal.recipientName},</p>
          <p>Just following up on the proposal we sent: <strong>${proposal.title}</strong>.</p>
          <p>We'd love to hear your thoughts. Click below to review:</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${viewUrl}" style="display:inline-block;background:${brand.primaryColor};color:white;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;">View Proposal</a>
          </div>
        </div>
        <div style="padding:16px 24px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;">
          <p>${brand.companyName}</p>
        </div>
      </div>`;
  }
}
