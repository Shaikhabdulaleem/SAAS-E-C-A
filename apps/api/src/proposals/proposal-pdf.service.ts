import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { BrandingService, type BrandConfig } from './branding.service';
import { PROPOSAL_TEMPLATES, type PdfTemplateData } from './templates';

const UPLOADS_DIR = path.resolve(process.cwd(), '..', '..', 'uploads', 'proposals');

@Injectable()
export class ProposalPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branding: BrandingService,
  ) {}

  async generate(proposalId: string): Promise<string> {
    const proposal = await this.prisma.proposal.findUniqueOrThrow({
      where: { id: proposalId },
      include: { services: { orderBy: { sortOrder: 'asc' } }, sections: { orderBy: { sortOrder: 'asc' } } },
    });

    const brand = proposal.brandingSnapshot
      ? (proposal.brandingSnapshot as unknown as BrandConfig)
      : await this.branding.resolve(proposal.createdByType, proposal.tenantId ?? undefined);

    const templateData: PdfTemplateData = {
      proposalNumber: proposal.proposalNumber ?? '',
      title: proposal.title,
      recipientName: proposal.recipientName,
      recipientEmail: proposal.recipientEmail ?? undefined,
      companyName: proposal.companyName ?? undefined,
      status: proposal.status,
      billingCycle: proposal.billingCycle,
      contractDuration: proposal.contractDuration ?? undefined,
      paymentTerms: proposal.paymentTerms ?? undefined,
      setupFee: Number(proposal.setupFee),
      subtotal: Number(proposal.subtotal),
      discountAmount: Number(proposal.discountAmount),
      total: Number(proposal.total),
      validUntil: proposal.validUntil?.toISOString(),
      customIntroMessage: proposal.customIntroMessage ?? undefined,
      createdAt: proposal.createdAt.toISOString(),
      services: proposal.services.map((s) => ({
        serviceType: s.serviceType,
        planName: s.planName,
        listPrice: Number(s.listPrice),
        discountPercentage: Number(s.discountPercentage),
        finalPrice: Number(s.finalPrice),
        features: Array.isArray(s.features) ? (s.features as string[]) : [],
        customDescription: s.customDescription ?? undefined,
      })),
      sections: proposal.sections.map((s) => ({
        sectionKey: s.sectionKey,
        sectionTitle: s.sectionTitle,
        content: s.content,
        isEnabled: s.isEnabled,
      })),
      brand,
    };

    const templateId = (proposal as any).templateId ?? 'modern';
    const template = PROPOSAL_TEMPLATES[templateId] ?? PROPOSAL_TEMPLATES['modern'];
    const html = template.generate(templateData);

    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const fileName = `${proposalId}.pdf`;
    const filePath = path.join(UPLOADS_DIR, fileName);

    try {
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.default.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      await page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
      await browser.close();
    } catch (err) {
      throw new InternalServerErrorException(`PDF generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    const pdfUrl = `/uploads/proposals/${fileName}`;
    await this.prisma.proposal.update({ where: { id: proposalId }, data: { pdfUrl } });

    return pdfUrl;
  }

  getFilePath(proposalId: string): string | null {
    const filePath = path.join(UPLOADS_DIR, `${proposalId}.pdf`);
    return fs.existsSync(filePath) ? filePath : null;
  }
}
