import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { useProposalForm } from '../ProposalFormContext';

export function PricingTermsStep() {
  const { state, setState } = useProposalForm();
  const terms = state.pricingTerms;
  const services = state.selectedServices;

  const set = (field: keyof typeof terms, value: string | number) => {
    setState((prev) => ({ ...prev, pricingTerms: { ...prev.pricingTerms, [field]: value } }));
  };

  const serviceSubtotal = services.reduce((sum, s) => sum + s.finalPrice, 0);
  const billingMultiplier = terms.billingCycle === 'quarterly' ? 3 : terms.billingCycle === 'annually' ? 12 : 1;
  const periodSubtotal = serviceSubtotal * billingMultiplier;
  const discountSavings = terms.billingCycle === 'quarterly' ? 0.05 : terms.billingCycle === 'annually' ? 0.15 : 0;
  const discountedSubtotal = periodSubtotal * (1 - discountSavings);

  let discountAmount = 0;
  if (terms.discountType === 'percent') discountAmount = discountedSubtotal * Math.min(terms.discountValue, 100) / 100;
  if (terms.discountType === 'fixed') discountAmount = Math.min(terms.discountValue, discountedSubtotal);

  const total = Math.max(0, discountedSubtotal - discountAmount + terms.setupFee);
  const totalMccCost = services.reduce((sum, s) => sum + s.mccBaseCost, 0) * billingMultiplier;
  const profit = total - totalMccCost;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Pricing Breakdown</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 text-muted-foreground">Service</th>
                  <th className="text-left py-2 text-muted-foreground">Plan</th>
                  <th className="text-right py-2 text-muted-foreground">Price</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.serviceType} className="border-b">
                    <td className="py-2 capitalize">{s.serviceType.replace(/_/g, ' ')}</td>
                    <td className="py-2">{s.planName}</td>
                    <td className="py-2 text-right font-medium">${s.finalPrice.toLocaleString()}/mo</td>
                  </tr>
                ))}
                {services.length === 0 && (
                  <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">No services selected</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Billing & Terms</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Billing Cycle</Label>
                <Select value={terms.billingCycle} onValueChange={(v) => set('billingCycle', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly (5% savings)</SelectItem>
                    <SelectItem value="annually">Annually (15% savings)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Contract Duration</Label>
                <Select value={terms.contractDuration} onValueChange={(v) => set('contractDuration', v)}>
                  <SelectTrigger><SelectValue placeholder="Select duration" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3 months">3 Months</SelectItem>
                    <SelectItem value="6 months">6 Months</SelectItem>
                    <SelectItem value="12 months">12 Months</SelectItem>
                    <SelectItem value="24 months">24 Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Payment Terms</Label>
                <Select value={terms.paymentTerms} onValueChange={(v) => set('paymentTerms', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Due on receipt">Due on Receipt</SelectItem>
                    <SelectItem value="Net 15">Net 15</SelectItem>
                    <SelectItem value="Net 30">Net 30</SelectItem>
                    <SelectItem value="Net 60">Net 60</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>One-time Setup Fee ($)</Label>
                <Input
                  type="number"
                  min="0"
                  value={terms.setupFee}
                  onChange={(e) => set('setupFee', Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Additional Discount Type</Label>
                <Select value={terms.discountType} onValueChange={(v) => set('discountType', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="percent">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {terms.discountType !== 'none' && (
                <div className="space-y-1.5">
                  <Label>{terms.discountType === 'percent' ? 'Discount (%)' : 'Discount ($)'}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={terms.discountValue}
                    onChange={(e) => set('discountValue', Number(e.target.value) || 0)}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Total</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monthly Subtotal</span>
              <span>${serviceSubtotal.toLocaleString()}</span>
            </div>
            {terms.billingCycle !== 'monthly' && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{terms.billingCycle === 'quarterly' ? 'Quarterly' : 'Annual'} Total</span>
                  <span>${periodSubtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>Billing Savings ({(discountSavings * 100).toFixed(0)}%)</span>
                  <span>-${(periodSubtotal * discountSavings).toLocaleString()}</span>
                </div>
              </>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span>
                <span>-${discountAmount.toLocaleString()}</span>
              </div>
            )}
            {terms.setupFee > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Setup Fee</span>
                <span>${terms.setupFee.toLocaleString()}</span>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">${total.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Private — Your Profit</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">MCC Cost</span>
              <span>${totalMccCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Your Profit</span>
              <span className={profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>${profit.toLocaleString()}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Not shown in the proposal PDF or to the recipient.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
