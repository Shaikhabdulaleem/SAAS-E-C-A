import type { BrandConfig } from '../../proposals/branding.service';

export interface InvoicePdfLineItem {
  name: string;
  description?: string;
  serviceType: string;
  planName?: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  total: number;
}

export interface InvoicePdfData {
  number: string;
  status: string;
  invoiceType: string;
  recipientName: string;
  recipientEmail?: string;
  recipientCompany?: string;
  issueDate: string;
  dueDate?: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  paymentTerms?: string;
  notes?: string;
  paymentInstructions?: string;
  lineItems: InvoicePdfLineItem[];
  brand: BrandConfig;
}

export const SERVICE_LABELS: Record<string, string> = {
  email_marketing: 'Email Marketing',
  cold_email: 'Cold Outreach',
  cold_outreach: 'Cold Outreach',
  crm: 'CRM',
  ai_assistant: 'AI Call Assistant',
  ai_call_assistant: 'AI Call Assistant',
  analytics: 'Advanced Analytics',
  advanced_analytics: 'Advanced Analytics',
  setup_fee: 'Setup Fee',
  custom: 'Custom',
};

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function optional(value: string | undefined | null): string {
  return value ? escapeHtml(value) : '';
}

export function money(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount || 0));
}

export function date(value?: string): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
