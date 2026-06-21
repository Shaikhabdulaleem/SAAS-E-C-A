import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Check, ChevronLeft, ChevronRight, Loader2, Save } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { ProposalFormProvider, useProposalForm, type ProposalFormState, type ServiceEntry, type SectionEntry } from './ProposalFormContext';
import { RecipientInfoStep } from './steps/RecipientInfoStep';
import { ServiceSelectionStep } from './steps/ServiceSelectionStep';
import { PricingTermsStep } from './steps/PricingTermsStep';
import { ContentBuilderStep } from './steps/ContentBuilderStep';
import { ReviewSendStep } from './steps/ReviewSendStep';

const STEPS = [
  { label: 'Recipient', component: RecipientInfoStep },
  { label: 'Services', component: ServiceSelectionStep },
  { label: 'Pricing', component: PricingTermsStep },
  { label: 'Content', component: ContentBuilderStep },
  { label: 'Review & Send', component: ReviewSendStep },
];

function WizardInner() {
  const navigate = useNavigate();
  const { state, setStep, isSaving, lastSaved, saveDraft, admin } = useProposalForm();
  const StepComponent = STEPS[state.step - 1].component;
  const basePath = admin ? '/mcc/proposals' : '/proposals';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{state.proposalId ? 'Edit Proposal' : 'Create Proposal'}</h1>
          <div className="flex items-center gap-2 mt-1">
            {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            {lastSaved && <span className="text-xs text-muted-foreground">Last saved {lastSaved.toLocaleTimeString()}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(basePath)}>Cancel</Button>
          <Button variant="outline" size="sm" onClick={() => void saveDraft()} disabled={isSaving}>
            <Save className="h-3.5 w-3.5 mr-1.5" />Save Draft
          </Button>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => (
          <div key={i} className="flex items-center flex-1">
            <button
              onClick={() => setStep(i + 1)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full ${
                state.step === i + 1
                  ? 'bg-primary text-primary-foreground'
                  : state.step > i + 1
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <span className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${
                state.step > i + 1 ? 'bg-emerald-500 text-white' : 'bg-white/20'
              }`}>
                {state.step > i + 1 ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1 shrink-0" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <StepComponent />

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={() => setStep(Math.max(1, state.step - 1))} disabled={state.step === 1}>
          <ChevronLeft className="h-4 w-4 mr-1" />Previous
        </Button>
        {state.step < 5 ? (
          <Button onClick={() => setStep(Math.min(5, state.step + 1))}>
            Next<ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function ProposalCreate({ admin = false }: { admin?: boolean }) {
  const { id } = useParams();
  const [initialData, setInitialData] = useState<Partial<ProposalFormState> | null>(id ? null : {});

  useEffect(() => {
    if (!id) return;
    const basePath = admin ? '/admin/proposals' : '/proposals';
    apiRequest<any>(`${basePath}/${id}`)
      .then((p) => {
        setInitialData({
          proposalId: p.id,
          recipientInfo: {
            title: p.title,
            recipientName: p.recipientName,
            recipientEmail: p.recipientEmail ?? '',
            companyName: p.companyName ?? '',
            contactId: p.contactId ?? '',
            validUntil: p.validUntil ? new Date(p.validUntil).toISOString().split('T')[0] : '',
          },
          selectedServices: (p.services ?? []).map((s: any) => ({
            serviceType: s.serviceType,
            planName: s.planName,
            features: Array.isArray(s.features) ? s.features : [],
            listPrice: Number(s.listPrice),
            discountPercentage: Number(s.discountPercentage),
            finalPrice: Number(s.finalPrice),
            customDescription: s.customDescription ?? '',
            mccBaseCost: Number(s.mccBaseCost ?? 0),
            creatorMargin: Number(s.creatorMargin ?? 0),
          })),
          templateId: p.templateId ?? 'modern',
          pricingTerms: {
            billingCycle: p.billingCycle ?? 'monthly',
            contractDuration: p.contractDuration ?? '',
            paymentTerms: p.paymentTerms ?? 'Net 15',
            setupFee: Number(p.setupFee ?? 0),
            discountType: p.discountType ?? 'none',
            discountValue: Number(p.discountValue ?? 0),
          },
          content: {
            introMessage: p.customIntroMessage ?? '',
            sections: (p.sections ?? []).map((s: any) => ({
              sectionKey: s.sectionKey,
              sectionTitle: s.sectionTitle,
              content: s.content,
              isEnabled: s.isEnabled,
              sortOrder: s.sortOrder,
            })),
          },
          sendOptions: {
            toEmail: p.recipientEmail ?? '',
            ccEmail: '',
            subject: `Proposal: ${p.title}`,
            message: '',
            enableTracking: true,
            requireSignature: false,
            attachPdf: true,
            followUpDays: 3,
          },
        });
      })
      .catch(() => setInitialData({}));
  }, [id, admin]);

  if (!initialData) return <div className="py-12 text-center text-sm text-muted-foreground">Loading proposal...</div>;

  return (
    <ProposalFormProvider admin={admin} initialData={initialData}>
      <WizardInner />
    </ProposalFormProvider>
  );
}
