import type { PdfTemplateData } from './proposal-pdf.types';
import { generateProposalHtml as modernTemplate } from './proposal-pdf.template';
import { generateProposalHtml as classicTemplate } from './proposal-pdf-classic.template';
import { generateProposalHtml as minimalTemplate } from './proposal-pdf-minimal.template';

export { type PdfTemplateData } from './proposal-pdf.types';

export interface ProposalTemplateEntry {
  id: string;
  name: string;
  description: string;
  generate: (data: PdfTemplateData) => string;
}

export const PROPOSAL_TEMPLATES: Record<string, ProposalTemplateEntry> = {
  modern: {
    id: 'modern',
    name: 'Modern',
    description: 'Bold gradients, card-based layouts, and vibrant accent colors',
    generate: modernTemplate,
  },
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional serif typography with formal, structured layout',
    generate: classicTemplate,
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean whitespace-driven design with monochrome palette',
    generate: minimalTemplate,
  },
};
