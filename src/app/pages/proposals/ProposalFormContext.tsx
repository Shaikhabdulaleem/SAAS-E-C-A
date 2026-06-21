import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { apiRequest } from '../../lib/api';

export interface ServiceEntry {
  serviceType: string;
  planName: string;
  features: string[];
  listPrice: number;
  discountPercentage: number;
  finalPrice: number;
  customDescription: string;
  mccBaseCost: number;
  creatorMargin: number;
}

export interface SectionEntry {
  sectionKey: string;
  sectionTitle: string;
  content: unknown;
  isEnabled: boolean;
  sortOrder: number;
}

export interface TermsItemData { title: string; text: string; }
export interface TimelineStepData { title: string; description: string; }

export const DEFAULT_TERMS_ITEMS: TermsItemData[] = [
  { title: 'Agreement', text: 'This proposal constitutes an offer for the described services. Acceptance creates a binding agreement between the parties.' },
  { title: 'Payment', text: 'Invoices are due per the payment terms stated above. Late payments may incur a 1.5% monthly interest charge.' },
  { title: 'Term', text: 'The agreement is for the contract duration specified above and renews automatically unless either party provides 30 days written notice.' },
  { title: 'Cancellation', text: 'Either party may terminate with 30 days written notice. Early termination fees may apply for annual contracts.' },
  { title: 'Confidentiality', text: 'Both parties agree to keep confidential information shared during the engagement private.' },
  { title: 'Data Protection', text: 'All data will be handled in compliance with applicable privacy laws and regulations.' },
  { title: 'Limitation of Liability', text: 'Liability is limited to the total fees paid in the 12 months preceding the claim.' },
  { title: 'Validity', text: 'This proposal is valid until the date specified on the cover page.' },
];

export const DEFAULT_TIMELINE_STEPS: TimelineStepData[] = [
  { title: 'Week 1 — Onboarding & Setup', description: 'Account configuration, branding setup, and initial platform tour.' },
  { title: 'Week 2 — Data Migration', description: 'Import existing data, configure integrations, and verify data integrity.' },
  { title: 'Week 3 — Training', description: 'Team training sessions, workflow optimization, and best practice guidance.' },
  { title: 'Week 4 — Launch & Support', description: 'Go live with full support, performance monitoring, and optimization.' },
];

export interface ProposalFormState {
  step: number;
  proposalId: string | null;
  recipientInfo: {
    title: string;
    recipientName: string;
    recipientEmail: string;
    companyName: string;
    contactId: string;
    validUntil: string;
  };
  selectedServices: ServiceEntry[];
  pricingTerms: {
    billingCycle: string;
    contractDuration: string;
    paymentTerms: string;
    setupFee: number;
    discountType: string;
    discountValue: number;
  };
  templateId: string;
  content: {
    introMessage: string;
    sections: SectionEntry[];
  };
  sendOptions: {
    toEmail: string;
    ccEmail: string;
    subject: string;
    message: string;
    enableTracking: boolean;
    requireSignature: boolean;
    attachPdf: boolean;
    followUpDays: number;
  };
}

const defaultState: ProposalFormState = {
  step: 1,
  proposalId: null,
  recipientInfo: { title: '', recipientName: '', recipientEmail: '', companyName: '', contactId: '', validUntil: '' },
  selectedServices: [],
  pricingTerms: { billingCycle: 'monthly', contractDuration: '', paymentTerms: 'Net 15', setupFee: 0, discountType: 'none', discountValue: 0 },
  templateId: 'modern',
  content: {
    introMessage: '',
    sections: [
      { sectionKey: 'cover', sectionTitle: 'Cover Page', content: null, isEnabled: true, sortOrder: 0 },
      { sectionKey: 'executive_summary', sectionTitle: 'Executive Summary', content: null, isEnabled: true, sortOrder: 1 },
      { sectionKey: 'about_us', sectionTitle: 'About Us', content: { text: '' }, isEnabled: true, sortOrder: 2 },
      { sectionKey: 'pricing', sectionTitle: 'Pricing Summary', content: null, isEnabled: true, sortOrder: 3 },
      { sectionKey: 'timeline', sectionTitle: 'Implementation Timeline', content: { steps: DEFAULT_TIMELINE_STEPS }, isEnabled: true, sortOrder: 4 },
      { sectionKey: 'terms', sectionTitle: 'Terms & Conditions', content: { items: DEFAULT_TERMS_ITEMS }, isEnabled: true, sortOrder: 5 },
      { sectionKey: 'signature', sectionTitle: 'Acceptance & Signature', content: null, isEnabled: true, sortOrder: 6 },
    ],
  },
  sendOptions: { toEmail: '', ccEmail: '', subject: '', message: '', enableTracking: true, requireSignature: false, attachPdf: true, followUpDays: 3 },
};

interface ProposalFormContextValue {
  state: ProposalFormState;
  setState: (updater: (prev: ProposalFormState) => ProposalFormState) => void;
  setStep: (step: number) => void;
  isSaving: boolean;
  lastSaved: Date | null;
  saveDraft: () => Promise<void>;
  admin: boolean;
}

const Context = createContext<ProposalFormContextValue | null>(null);

export function ProposalFormProvider({ children, admin = false, initialData }: { children: ReactNode; admin?: boolean; initialData?: Partial<ProposalFormState> }) {
  const [state, setStateRaw] = useState<ProposalFormState>(() => ({ ...defaultState, ...initialData }));
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const setState = useCallback((updater: (prev: ProposalFormState) => ProposalFormState) => {
    setStateRaw(updater);
  }, []);

  const setStep = useCallback((step: number) => {
    setStateRaw((prev) => ({ ...prev, step }));
  }, []);

  const saveDraft = useCallback(async () => {
    setIsSaving(true);
    try {
      const basePath = admin ? '/admin/proposals' : '/proposals';
      const payload = buildPayload(state);

      if (state.proposalId) {
        await apiRequest(`${basePath}/${state.proposalId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        const result = await apiRequest<{ id: string }>(basePath, { method: 'POST', body: JSON.stringify({ ...payload, status: 'draft' }) });
        setStateRaw((prev) => ({ ...prev, proposalId: result.id }));
      }
      setLastSaved(new Date());
    } catch {
      // silent fail for auto-save
    } finally {
      setIsSaving(false);
    }
  }, [state, admin]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (state.recipientInfo.title && state.recipientInfo.recipientName) {
        void saveDraft();
      }
    }, 30000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [state, saveDraft]);

  return (
    <Context.Provider value={{ state, setState, setStep, isSaving, lastSaved, saveDraft, admin }}>
      {children}
    </Context.Provider>
  );
}

export function useProposalForm() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useProposalForm must be used inside ProposalFormProvider');
  return ctx;
}

function buildPayload(state: ProposalFormState) {
  return {
    title: state.recipientInfo.title,
    recipientName: state.recipientInfo.recipientName,
    recipientEmail: state.recipientInfo.recipientEmail,
    companyName: state.recipientInfo.companyName,
    contactId: state.recipientInfo.contactId || undefined,
    validUntil: state.recipientInfo.validUntil || undefined,
    billingCycle: state.pricingTerms.billingCycle,
    contractDuration: state.pricingTerms.contractDuration || undefined,
    paymentTerms: state.pricingTerms.paymentTerms || undefined,
    setupFee: state.pricingTerms.setupFee,
    discountType: state.pricingTerms.discountType,
    discountValue: state.pricingTerms.discountValue,
    templateId: state.templateId,
    customIntroMessage: state.content.introMessage || undefined,
    services: state.selectedServices.map((s) => ({
      serviceType: s.serviceType,
      planName: s.planName,
      listPrice: s.listPrice,
      discountPercentage: s.discountPercentage,
      features: s.features,
      customDescription: s.customDescription || undefined,
      mccBaseCost: s.mccBaseCost,
    })),
    sections: state.content.sections.map((s) => ({
      sectionKey: s.sectionKey,
      sectionTitle: s.sectionTitle,
      content: s.content,
      isEnabled: s.isEnabled,
      sortOrder: s.sortOrder,
    })),
  };
}
