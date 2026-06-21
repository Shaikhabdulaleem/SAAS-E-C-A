import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { BrandingService, type BrandConfig } from '../proposals/branding.service';
import { FinanceActivityService } from './finance-activity.service';
import { INVOICE_TEMPLATES } from './templates';

const UPLOADS_DIR = path.resolve(process.cwd(), '..', '..', 'uploads', 'finance-invoices');

@Injectable()
export class FinancePdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branding: BrandingService,
    private readonly activity: FinanceActivityService,
  ) {}

  async generate(invoiceId: string, actor: { actorType: string; actorId?: string }) {
    const invoice = await this.prisma.financeInvoice.findUnique({
      where: { id: invoiceId },
      include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const brand = invoice.brandingSnapshot
      ? (invoice.brandingSnapshot as unknown as BrandConfig)
      : await this.branding.resolve(invoice.createdByType, invoice.tenantId ?? undefined);

    const templateId = (invoice as any).templateId ?? 'modern';
    const template = INVOICE_TEMPLATES[templateId] ?? INVOICE_TEMPLATES['modern'];
    const html = template.generate({
      number: invoice.number,
      status: invoice.status,
      invoiceType: invoice.invoiceType,
      recipientName: invoice.recipientName,
      recipientEmail: invoice.recipientEmail ?? undefined,
      recipientCompany: invoice.recipientCompany ?? undefined,
      issueDate: invoice.issueDate.toISOString(),
      dueDate: invoice.dueDate?.toISOString(),
      billingPeriodStart: invoice.billingPeriodStart?.toISOString(),
      billingPeriodEnd: invoice.billingPeriodEnd?.toISOString(),
      subtotal: Number(invoice.subtotal),
      discountAmount: Number(invoice.discountAmount),
      taxRate: Number(invoice.taxRate),
      taxAmount: Number(invoice.taxAmount),
      total: Number(invoice.total),
      amountPaid: Number(invoice.amountPaid),
      balanceDue: Number(invoice.balanceDue),
      currency: invoice.currency,
      paymentTerms: invoice.paymentTerms ?? undefined,
      notes: invoice.notes ?? undefined,
      paymentInstructions: invoice.paymentInstructions ?? undefined,
      lineItems: invoice.lineItems.map((item) => ({
        name: item.name,
        description: item.description ?? undefined,
        serviceType: item.serviceType,
        planName: item.planName ?? undefined,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discountPercentage: Number(item.discountPercentage),
        total: Number(item.total),
      })),
      brand,
    });

    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

    const fileName = `${invoiceId}.pdf`;
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
    } catch (error) {
      throw new InternalServerErrorException(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const pdfUrl = `/uploads/finance-invoices/${fileName}`;
    await this.prisma.financeInvoice.update({
      where: { id: invoiceId },
      data: { pdfUrl, pdfGeneratedAt: new Date(), brandingSnapshot: brand as never },
    });
    await this.activity.create({ invoiceId, eventType: 'pdf_generated', actorType: actor.actorType, actorId: actor.actorId });
    return pdfUrl;
  }

  getFilePath(invoiceId: string) {
    const filePath = path.join(UPLOADS_DIR, `${invoiceId}.pdf`);
    return fs.existsSync(filePath) ? filePath : null;
  }
}
