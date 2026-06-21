import type { BrandConfig } from '../branding.service';

export interface ServiceItem {
  serviceType: string;
  planName: string;
  listPrice: number;
  discountPercentage: number;
  finalPrice: number;
  features: string[];
  customDescription?: string;
}

export interface SectionItem {
  sectionKey: string;
  sectionTitle: string;
  content: unknown;
  isEnabled: boolean;
}

export interface PdfTemplateData {
  proposalNumber: string;
  title: string;
  recipientName: string;
  recipientEmail?: string;
  companyName?: string;
  status: string;
  billingCycle: string;
  contractDuration?: string;
  paymentTerms?: string;
  setupFee: number;
  subtotal: number;
  discountAmount: number;
  total: number;
  validUntil?: string;
  customIntroMessage?: string;
  createdAt: string;
  services: ServiceItem[];
  sections: SectionItem[];
  brand: BrandConfig;
}

export const SERVICE_LABELS: Record<string, string> = {
  email_marketing: 'Email Marketing',
  cold_outreach: 'Cold Outreach',
  crm: 'CRM',
  ai_call_assistant: 'AI Call Assistant',
  advanced_analytics: 'Advanced Analytics',
};

export const SERVICE_ICONS: Record<string, string> = {
  email_marketing: '&#9993;',
  cold_outreach: '&#127919;',
  crm: '&#128101;',
  ai_call_assistant: '&#128222;',
  advanced_analytics: '&#128202;',
};

export function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function billingLabel(cycle: string): string {
  const labels: Record<string, string> = { monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Annually' };
  return labels[cycle] ?? cycle;
}
