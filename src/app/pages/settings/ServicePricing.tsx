import { useEffect, useState, type FormEvent } from 'react';
import { DollarSign } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

interface PricingItem {
  id?: string;
  serviceType: string;
  planName: string;
  mccCost: number;
  sellingPrice: number;
  marginAmount: number;
  marginPercentage: number;
  planFeatures: string[];
  isActive: boolean;
}

const SERVICE_DEFAULTS: Array<{ serviceType: string; label: string; plans: Array<{ name: string; mccCost: number }> }> = [
  { serviceType: 'email_marketing', label: 'Email Marketing', plans: [{ name: 'Growth', mccCost: 29 }, { name: 'Pro', mccCost: 89 }, { name: 'Enterprise', mccCost: 239 }] },
  { serviceType: 'cold_outreach', label: 'Cold Outreach', plans: [{ name: 'Growth', mccCost: 47 }, { name: 'Pro', mccCost: 119 }, { name: 'Enterprise', mccCost: 299 }] },
  { serviceType: 'ai_call_assistant', label: 'AI Call Assistant', plans: [{ name: 'Growth', mccCost: 59 }, { name: 'Pro', mccCost: 149 }, { name: 'Enterprise', mccCost: 359 }] },
  { serviceType: 'advanced_analytics', label: 'Advanced Analytics', plans: [{ name: 'Growth', mccCost: 29 }, { name: 'Pro', mccCost: 89 }, { name: 'Enterprise', mccCost: 209 }] },
];

function marginColor(pct: number) {
  if (pct >= 30) return 'text-emerald-600';
  if (pct >= 15) return 'text-amber-600';
  return 'text-red-600';
}

export function ServicePricing({ hideHeader = false }: { hideHeader?: boolean }) {
  const [items, setItems] = useState<PricingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<PricingItem[]>('/client/service-pricing')
      .then((data) => {
        const existing = data.map((d) => ({ ...d, mccCost: Number(d.mccCost), sellingPrice: Number(d.sellingPrice), marginAmount: Number(d.marginAmount), marginPercentage: Number(d.marginPercentage) }));
        const all: PricingItem[] = [];
        for (const svc of SERVICE_DEFAULTS) {
          for (const plan of svc.plans) {
            const found = existing.find((e) => e.serviceType === svc.serviceType && e.planName === plan.name);
            if (found) {
              all.push(found);
            } else {
              all.push({ serviceType: svc.serviceType, planName: plan.name, mccCost: plan.mccCost, sellingPrice: plan.mccCost * 1.5, marginAmount: plan.mccCost * 0.5, marginPercentage: 50, planFeatures: [], isActive: true });
            }
          }
        }
        setItems(all);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updatePrice = (index: number, sellingPrice: number) => {
    setItems((prev) => prev.map((item, i) => {
      if (i !== index) return item;
      const marginAmount = Math.round((sellingPrice - item.mccCost) * 100) / 100;
      const marginPercentage = item.mccCost > 0 ? Math.round(((sellingPrice - item.mccCost) / item.mccCost) * 10000) / 100 : 0;
      return { ...item, sellingPrice, marginAmount, marginPercentage };
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const belowCost = items.find((i) => i.sellingPrice < i.mccCost);
      if (belowCost) {
        setError(`Selling price for ${belowCost.serviceType} ${belowCost.planName} is below MCC cost.`);
        setSaving(false);
        return;
      }
      await apiRequest('/client/service-pricing', { method: 'PUT', body: JSON.stringify({ items }) });
      setMessage('Pricing saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {!hideHeader && (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10"><DollarSign className="h-4 w-4 text-primary" /></div>
          <div>
            <h1 className="text-xl font-semibold">Service Pricing</h1>
            <p className="text-sm text-muted-foreground">Set your selling prices for each service plan. Your margin is calculated automatically.</p>
          </div>
        </div>
      )}

      {(error || message) && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {error || message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {SERVICE_DEFAULTS.map((svc) => (
          <Card key={svc.serviceType} className="mb-4">
            <CardHeader><CardTitle className="text-base">{svc.label}</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-muted-foreground">Plan</th>
                    <th className="text-right py-2 text-muted-foreground">MCC Cost</th>
                    <th className="text-right py-2 text-muted-foreground">Your Price</th>
                    <th className="text-right py-2 text-muted-foreground">Margin</th>
                    <th className="text-right py-2 text-muted-foreground">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {items.filter((i) => i.serviceType === svc.serviceType).map((item) => {
                    const globalIdx = items.findIndex((i) => i.serviceType === item.serviceType && i.planName === item.planName);
                    const belowCost = item.sellingPrice < item.mccCost;
                    return (
                      <tr key={`${item.serviceType}-${item.planName}`} className="border-b">
                        <td className="py-2 font-medium">{item.planName}</td>
                        <td className="py-2 text-right text-muted-foreground">${item.mccCost.toFixed(2)}</td>
                        <td className="py-2 text-right">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.sellingPrice}
                            onChange={(e) => updatePrice(globalIdx, Number(e.target.value) || 0)}
                            className={`w-28 ml-auto text-right h-8 ${belowCost ? 'border-red-500' : ''}`}
                          />
                        </td>
                        <td className={`py-2 text-right font-medium ${marginColor(item.marginPercentage)}`}>
                          ${item.marginAmount.toFixed(2)}
                        </td>
                        <td className={`py-2 text-right font-medium ${marginColor(item.marginPercentage)}`}>
                          {item.marginPercentage.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))}

        <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Pricing'}</Button>
      </form>
    </div>
  );
}
