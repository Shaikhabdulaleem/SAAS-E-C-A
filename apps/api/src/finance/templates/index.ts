import type { InvoicePdfData } from './invoice-pdf.types';
import { generateInvoiceHtml as modernTemplate } from './invoice-pdf.template';
import { generateInvoiceHtml as classicTemplate } from './invoice-pdf-classic.template';
import { generateInvoiceHtml as minimalTemplate } from './invoice-pdf-minimal.template';

export { type InvoicePdfData } from './invoice-pdf.types';

export interface InvoiceTemplateEntry {
  id: string;
  name: string;
  description: string;
  generate: (data: InvoicePdfData) => string;
}

export const INVOICE_TEMPLATES: Record<string, InvoiceTemplateEntry> = {
  modern: {
    id: 'modern',
    name: 'Modern',
    description: 'Bold layout with colored header and card-style sections',
    generate: modernTemplate,
  },
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional formal invoice with serif typography',
    generate: classicTemplate,
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean, whitespace-heavy design with minimal decoration',
    generate: minimalTemplate,
  },
};
