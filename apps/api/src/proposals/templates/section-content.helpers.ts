import type { SectionItem } from './proposal-pdf.types';

export interface AboutUsContent {
  text: string;
}

export interface TermsItem {
  title: string;
  text: string;
}

export interface TimelineStep {
  title: string;
  description: string;
}

export const DEFAULT_TERMS: TermsItem[] = [
  { title: 'Agreement', text: 'This proposal constitutes an offer for the described services. Acceptance creates a binding agreement between the parties.' },
  { title: 'Payment', text: 'Invoices are due per the payment terms stated above. Late payments may incur a 1.5% monthly interest charge.' },
  { title: 'Term', text: 'The agreement is for the contract duration specified above and renews automatically unless either party provides 30 days written notice.' },
  { title: 'Cancellation', text: 'Either party may terminate with 30 days written notice. Early termination fees may apply for annual contracts.' },
  { title: 'Confidentiality', text: 'Both parties agree to keep confidential information shared during the engagement private.' },
  { title: 'Data Protection', text: 'All data will be handled in compliance with applicable privacy laws and regulations.' },
  { title: 'Limitation of Liability', text: 'Liability is limited to the total fees paid in the 12 months preceding the claim.' },
  { title: 'Validity', text: 'This proposal is valid until the date specified on the cover page.' },
];

export const DEFAULT_TIMELINE: TimelineStep[] = [
  { title: 'Week 1 — Onboarding & Setup', description: 'Account configuration, branding setup, and initial platform tour.' },
  { title: 'Week 2 — Data Migration', description: 'Import existing data, configure integrations, and verify data integrity.' },
  { title: 'Week 3 — Training', description: 'Team training sessions, workflow optimization, and best practice guidance.' },
  { title: 'Week 4 — Launch & Support', description: 'Go live with full support, performance monitoring, and optimization.' },
];

export function getAboutUsText(sections: SectionItem[], fallbackText: string): string {
  const section = sections.find((s) => s.sectionKey === 'about_us');
  const content = section?.content as AboutUsContent | null | undefined;
  if (content?.text) return content.text;
  return fallbackText;
}

export function getTermsItems(sections: SectionItem[]): TermsItem[] {
  const section = sections.find((s) => s.sectionKey === 'terms');
  const content = section?.content as { items?: TermsItem[] } | null | undefined;
  if (content?.items && Array.isArray(content.items) && content.items.length > 0) return content.items;
  return DEFAULT_TERMS;
}

export function getTimelineSteps(sections: SectionItem[]): TimelineStep[] {
  const section = sections.find((s) => s.sectionKey === 'timeline');
  const content = section?.content as { steps?: TimelineStep[] } | null | undefined;
  if (content?.steps && Array.isArray(content.steps) && content.steps.length > 0) return content.steps;
  return DEFAULT_TIMELINE;
}
