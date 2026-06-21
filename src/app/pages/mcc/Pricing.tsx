import { useEffect, useState } from 'react';
import { DollarSign, Save, ShieldCheck } from 'lucide-react';
import { useTenants, type Plan, type Service } from '../../contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Separator } from '../../components/ui/separator';

export function Pricing() {
  const { services, plans, refreshPricing, updateServicePricing, updatePlanPricing } = useTenants();
  const [serviceDrafts, setServiceDrafts] = useState<Record<string, Partial<Service>>>({});
  const [planDrafts, setPlanDrafts] = useState<Record<string, Partial<Plan>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const draftService = (service: Service) => ({ ...service, ...serviceDrafts[service.key] });
  const draftPlan = (plan: Plan) => ({ ...plan, ...planDrafts[plan.key] });

  useEffect(() => {
    void refreshPricing().catch(error => setError(error instanceof Error ? error.message : 'Unable to load pricing'));
  }, []);

  const saveService = async (service: Service) => {
    setSaving(`service-${service.key}`);
    setError('');
    setMessage('');
    try {
      await updateServicePricing(service.key, draftService(service));
      await refreshPricing();
      setServiceDrafts(prev => {
        const next = { ...prev };
        delete next[service.key];
        return next;
      });
      setMessage(`${service.label} pricing saved`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save service pricing');
    } finally {
      setSaving(null);
    }
  };

  const savePlan = async (plan: Plan) => {
    setSaving(`plan-${plan.key}`);
    setError('');
    setMessage('');
    try {
      await updatePlanPricing(plan.key, draftPlan(plan));
      await refreshPricing();
      setPlanDrafts(prev => {
        const next = { ...prev };
        delete next[plan.key];
        return next;
      });
      setMessage(`${plan.label} plan saved`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save plan pricing');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <h1 className="text-foreground">Plans & Module Pricing</h1>
        </div>
        <p className="text-sm text-muted-foreground">Control module fees, plan prices, and which services each plan includes.</p>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <Card className="p-0">
        <CardHeader>
          <CardTitle className="text-base">Module Fees</CardTitle>
          <CardDescription>Monthly module prices used for internal packaging and sales decisions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {services.map((service, index) => {
            const draft = draftService(service);
            return (
              <div key={service.key}>
                {index > 0 && <Separator className="mb-3" />}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_90px_90px] gap-3 items-end">
                  <div className="space-y-1">
                    <Label>{service.label}</Label>
                    <p className="text-xs text-muted-foreground">{service.description}</p>
                  </div>
                  <div className="space-y-1">
                    <Label>Price</Label>
                    <Input
                      type="number"
                      min="0"
                      value={draft.monthlyPrice ?? 0}
                      onChange={event => setServiceDrafts(prev => ({ ...prev, [service.key]: { ...prev[service.key], monthlyPrice: Number(event.target.value) } }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Active</Label>
                    <div className="h-9 flex items-center">
                      <Switch
                        checked={draft.isActive !== false}
                        onCheckedChange={value => setServiceDrafts(prev => ({ ...prev, [service.key]: { ...prev[service.key], isActive: value } }))}
                      />
                    </div>
                  </div>
                  <Button size="sm" onClick={() => saveService(service)} disabled={saving === `service-${service.key}`}>
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    Save
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="p-0">
        <CardHeader>
          <CardTitle className="text-base">Plan Packages</CardTitle>
          <CardDescription>Edit plan prices and included modules.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {plans.map(plan => {
            const draft = draftPlan(plan);
            return (
              <div key={plan.key} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{plan.label}</p>
                    <p className="text-xs text-muted-foreground">{plan.key}</p>
                  </div>
                  <Switch
                    checked={draft.isActive !== false}
                    onCheckedChange={value => setPlanDrafts(prev => ({ ...prev, [plan.key]: { ...prev[plan.key], isActive: value } }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Plan Price</Label>
                  <Input
                    type="number"
                    min="0"
                    value={draft.price}
                    onChange={event => setPlanDrafts(prev => ({ ...prev, [plan.key]: { ...prev[plan.key], price: Number(event.target.value) } }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Included Modules</Label>
                  {services.filter(service => service.isActive !== false).map(service => {
                    const checked = (draft.services ?? []).includes(service.key);
                    return (
                      <label key={service.key} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                        <span>{service.label}</span>
                        <Switch
                          checked={checked}
                          onCheckedChange={value => {
                            const current = draft.services ?? [];
                            const next = value ? [...current, service.key] : current.filter(key => key !== service.key);
                            setPlanDrafts(prev => ({ ...prev, [plan.key]: { ...prev[plan.key], services: next } }));
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
                <Button size="sm" className="w-full" onClick={() => savePlan(plan)} disabled={saving === `plan-${plan.key}`}>
                  <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                  Save Plan
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
