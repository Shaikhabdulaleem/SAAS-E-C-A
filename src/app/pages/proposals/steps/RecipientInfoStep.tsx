import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { useProposalForm } from '../ProposalFormContext';

export function RecipientInfoStep() {
  const { state, setState } = useProposalForm();
  const info = state.recipientInfo;

  const set = (field: keyof typeof info, value: string) => {
    setState((prev) => ({ ...prev, recipientInfo: { ...prev.recipientInfo, [field]: value } }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recipient Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <Label>Proposal Title *</Label>
            <Input
              placeholder="e.g., Digital Marketing Growth Package"
              value={info.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Recipient Name *</Label>
            <Input
              placeholder="Contact person name"
              value={info.recipientName}
              onChange={(e) => set('recipientName', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="email@company.com"
              value={info.recipientEmail}
              onChange={(e) => set('recipientEmail', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Company Name</Label>
            <Input
              placeholder="Company or organization"
              value={info.companyName}
              onChange={(e) => set('companyName', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Valid Until</Label>
            <Input
              type="date"
              value={info.validUntil}
              onChange={(e) => set('validUntil', e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
