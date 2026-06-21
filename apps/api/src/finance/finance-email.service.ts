import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailDeliveryService } from '../providers/services/email-delivery.service';
import { BrandingService } from '../proposals/branding.service';
import { FinanceActivityService } from './finance-activity.service';

@Injectable()
export class FinanceEmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailDeliveryService,
    private readonly branding: BrandingService,
    private readonly activity: FinanceActivityService,
  ) {}

  async sendInvoice(invoiceId: string, input: { toEmail?: string; subject?: string; message?: string; baseUrl?: string; actorId?: string; actorType: string }) {
    const invoice = await this.prisma.financeInvoice.findUnique({ where: { id: invoiceId }, include: { lineItems: true } });
    if (!invoice) throw new BadRequestException('Invoice not found');

    const to = input.toEmail || invoice.recipientEmail;
    if (!to) throw new BadRequestException('Recipient email is required');

    const brand = await this.branding.resolve(invoice.createdByType, invoice.tenantId ?? undefined);
    const baseUrl = input.baseUrl || process.env.APP_URL || 'http://localhost:5173';
    const publicUrl = `${baseUrl.replace(/\/$/, '')}/invoice/public/${invoice.publicToken}`;
    const subject = input.subject || `Invoice ${invoice.number} from ${brand.companyName}`;
    const html = this.invoiceEmailHtml({
      companyName: brand.companyName,
      primaryColor: brand.primaryColor,
      message: input.message,
      invoiceNumber: invoice.number,
      recipientName: invoice.recipientName,
      total: Number(invoice.total),
      balanceDue: Number(invoice.balanceDue),
      dueDate: invoice.dueDate?.toLocaleDateString() ?? 'upon receipt',
      currency: invoice.currency,
      publicUrl,
    });

    await this.email.send({
      tenantId: invoice.tenantId ?? 'mcc',
      to,
      fromEmail: brand.contactEmail || process.env.DEFAULT_FROM_EMAIL || 'no-reply@nexushq.com',
      fromName: brand.companyName,
      subject,
      html,
      text: `Invoice ${invoice.number} is ready. View it here: ${publicUrl}`,
      trackingArgs: { financeInvoiceId: invoice.id },
    });

    const sentAt = new Date();
    await this.prisma.financeInvoice.update({
      where: { id: invoice.id },
      data: { status: invoice.status === 'draft' ? 'sent' : invoice.status, sentAt },
    });
    await this.activity.create({ invoiceId: invoice.id, eventType: 'sent', actorType: input.actorType, actorId: input.actorId, metadata: { to } });
    return { sent: true, to, publicUrl };
  }

  private invoiceEmailHtml(input: {
    companyName: string;
    primaryColor: string;
    message?: string;
    invoiceNumber: string;
    recipientName: string;
    total: number;
    balanceDue: number;
    dueDate: string;
    currency: string;
    publicUrl: string;
  }) {
    const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: input.currency }).format(input.balanceDue || input.total);
    return `
      <div style="font-family:Inter,Arial,sans-serif;color:#111827;line-height:1.5">
        <h2 style="color:${input.primaryColor};margin-bottom:8px">${input.companyName}</h2>
        <p>Hello ${this.escape(input.recipientName)},</p>
        <p>${this.escape(input.message || `Invoice ${input.invoiceNumber} is ready for review.`)}</p>
        <div style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin:18px 0">
          <p style="margin:0;color:#6b7280">Invoice</p>
          <h3 style="margin:4px 0">${this.escape(input.invoiceNumber)}</h3>
          <p style="margin:0">Balance due: <strong>${money}</strong></p>
          <p style="margin:4px 0 0">Due: <strong>${this.escape(input.dueDate)}</strong></p>
        </div>
        <p><a href="${this.escape(input.publicUrl)}" style="display:inline-block;background:${input.primaryColor};color:white;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700">View Invoice</a></p>
      </div>
    `;
  }

  private escape(value: string) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
