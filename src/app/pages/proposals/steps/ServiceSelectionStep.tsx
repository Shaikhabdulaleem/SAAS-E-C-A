import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { useProposalForm, type ServiceEntry } from '../ProposalFormContext';

const SERVICES = [
  {
    type: 'email_marketing',
    label: 'Email Marketing',
    icon: '✉️',
    plans: [
      { name: 'Growth', basePrice: 49, features: ['Up to 10,000 contacts', '5 campaigns/month', 'Basic templates', 'Open & click tracking'] },
      { name: 'Pro', basePrice: 149, features: ['Up to 50,000 contacts', 'Unlimited campaigns', 'Custom templates', 'A/B testing', 'Advanced analytics'] },
      { name: 'Enterprise', basePrice: 399, features: ['Unlimited contacts', 'Dedicated IP', 'Priority support', 'Custom integrations', 'White-label'] },
    ],
  },
  {
    type: 'cold_outreach',
    label: 'Cold Outreach',
    icon: '🎯',
    plans: [
      { name: 'Growth', basePrice: 79, features: ['3 mailboxes', '1,000 prospects/month', 'Email sequences', 'Basic warmup'] },
      { name: 'Pro', basePrice: 199, features: ['10 mailboxes', '5,000 prospects/month', 'Multi-step sequences', 'Advanced warmup', 'Domain health'] },
      { name: 'Enterprise', basePrice: 499, features: ['Unlimited mailboxes', 'Unlimited prospects', 'Auto-provisioning', 'Dedicated domains', 'Priority deliverability'] },
    ],
  },
  {
    type: 'crm',
    label: 'CRM',
    icon: '👥',
    plans: [
      { name: 'Growth', basePrice: 29, features: ['Up to 1,000 contacts', 'Deal pipeline', 'Activity tracking', 'Basic reporting'] },
      { name: 'Pro', basePrice: 99, features: ['Up to 10,000 contacts', 'Multiple pipelines', 'Custom fields', 'Automation rules', 'Integrations'] },
      { name: 'Enterprise', basePrice: 249, features: ['Unlimited contacts', 'Advanced workflows', 'Custom reports', 'API access', 'Dedicated support'] },
    ],
  },
  {
    type: 'ai_call_assistant',
    label: 'AI Call Assistant',
    icon: '📞',
    plans: [
      { name: 'Growth', basePrice: 99, features: ['100 minutes/month', 'Call transcription', 'Basic insights', 'Call recording'] },
      { name: 'Pro', basePrice: 249, features: ['500 minutes/month', 'AI summaries', 'Sentiment analysis', 'Action items', 'CRM sync'] },
      { name: 'Enterprise', basePrice: 599, features: ['Unlimited minutes', 'Real-time coaching', 'Custom AI models', 'Team analytics', 'Priority processing'] },
    ],
  },
  {
    type: 'advanced_analytics',
    label: 'Advanced Analytics',
    icon: '📊',
    plans: [
      { name: 'Growth', basePrice: 49, features: ['Standard dashboards', 'Weekly reports', 'Basic KPIs', 'Data export'] },
      { name: 'Pro', basePrice: 149, features: ['Custom dashboards', 'Real-time reporting', 'Advanced KPIs', 'Trend analysis', 'Scheduled reports'] },
      { name: 'Enterprise', basePrice: 349, features: ['White-label reports', 'Predictive analytics', 'Custom integrations', 'Raw data access', 'Dedicated analyst'] },
    ],
  },
];

export function ServiceSelectionStep() {
  const { state, setState } = useProposalForm();

  const isSelected = (type: string) => state.selectedServices.some((s) => s.serviceType === type);

  const toggleService = (type: string) => {
    setState((prev) => {
      if (isSelected(type)) {
        return { ...prev, selectedServices: prev.selectedServices.filter((s) => s.serviceType !== type) };
      }
      const svc = SERVICES.find((s) => s.type === type)!;
      const plan = svc.plans[0];
      const entry: ServiceEntry = {
        serviceType: type,
        planName: plan.name,
        features: plan.features,
        listPrice: plan.basePrice,
        discountPercentage: 0,
        finalPrice: plan.basePrice,
        customDescription: '',
        mccBaseCost: plan.basePrice * 0.6,
        creatorMargin: plan.basePrice * 0.4,
      };
      return { ...prev, selectedServices: [...prev.selectedServices, entry] };
    });
  };

  const updateService = (type: string, updates: Partial<ServiceEntry>) => {
    setState((prev) => ({
      ...prev,
      selectedServices: prev.selectedServices.map((s) => {
        if (s.serviceType !== type) return s;
        const updated = { ...s, ...updates };
        updated.finalPrice = Math.round(updated.listPrice * (1 - updated.discountPercentage / 100) * 100) / 100;
        updated.creatorMargin = Math.round((updated.finalPrice - updated.mccBaseCost) * 100) / 100;
        return updated;
      }),
    }));
  };

  const changePlan = (type: string, planName: string) => {
    const svc = SERVICES.find((s) => s.type === type)!;
    const plan = svc.plans.find((p) => p.name === planName)!;
    updateService(type, { planName, features: plan.features, listPrice: plan.basePrice, mccBaseCost: plan.basePrice * 0.6 });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Select the services to include in this proposal.</p>
      <div className="grid grid-cols-1 gap-4">
        {SERVICES.map((svc) => {
          const selected = state.selectedServices.find((s) => s.serviceType === svc.type);
          return (
            <Card key={svc.type} className={`transition-all ${selected ? 'ring-2 ring-primary' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{svc.icon}</span>
                    <CardTitle className="text-base">{svc.label}</CardTitle>
                  </div>
                  <button
                    onClick={() => toggleService(svc.type)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {selected ? '✓ Included' : 'Add'}
                  </button>
                </div>
              </CardHeader>
              {selected && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Plan</Label>
                      <Select value={selected.planName} onValueChange={(v) => changePlan(svc.type, v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {svc.plans.map((p) => <SelectItem key={p.name} value={p.name}>{p.name} — ${p.basePrice}/mo</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Price ($)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={selected.listPrice}
                        onChange={(e) => updateService(svc.type, { listPrice: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Discount (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={selected.discountPercentage}
                        onChange={(e) => updateService(svc.type, { discountPercentage: Number(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.features.map((f, i) => (
                      <span key={i} className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs">✓ {f}</span>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Custom Description (shown in PDF)</Label>
                    <Textarea
                      rows={2}
                      placeholder="Optional description for this service..."
                      value={selected.customDescription}
                      onChange={(e) => updateService(svc.type, { customDescription: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-4 text-sm bg-muted/50 rounded-lg px-3 py-2">
                    <span>Final: <strong className="text-primary">${selected.finalPrice.toLocaleString()}/mo</strong></span>
                    <span className="text-muted-foreground">|</span>
                    <span className={`${selected.creatorMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      Margin: ${selected.creatorMargin.toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
