import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { CheckCircle2, FileText, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';

type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';

interface Proposal {
  id: string;
  title: string;
  scope: string;
  recipientName?: string;
  recipientEmail?: string;
  companyName?: string;
  status: ProposalStatus;
  subtotal: number;
  discountType: string;
  discountValue: number;
  total: number;
  validUntil?: string;
  createdAt: string;
  lineItems: Array<{ id: string; name: string; quantity: number; unitPrice: number; total: number }>;
}

const emptyForm = {
  title: '',
  recipientName: '',
  recipientEmail: '',
  companyName: '',
  status: 'draft' as ProposalStatus,
  itemName: '',
  quantity: '1',
  unitPrice: '',
  discountType: 'none',
  discountValue: '0',
  validUntil: '',
  notes: '',
};

export function Proposals({ admin = false }: { admin?: boolean }) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const basePath = admin ? '/admin/proposals' : '/proposals';
  const totals = useMemo(() => ({
    count: proposals.length,
    accepted: proposals.filter(proposal => proposal.status === 'accepted').length,
    value: proposals.reduce((sum, proposal) => sum + Number(proposal.total), 0),
  }), [proposals]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<Proposal[]>(basePath);
      setProposals(data.map(normalizeProposal));
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to load proposals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [admin]);

  const set = (field: keyof typeof emptyForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const createProposal = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest<Proposal>(basePath, {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          recipientName: form.recipientName,
          recipientEmail: form.recipientEmail,
          companyName: form.companyName,
          status: form.status,
          discountType: form.discountType,
          discountValue: Number(form.discountValue) || 0,
          validUntil: form.validUntil || undefined,
          notes: form.notes,
          lineItems: [{ name: form.itemName || 'Service package', quantity: Number(form.quantity) || 1, unitPrice: Number(form.unitPrice) || 0 }],
        }),
      });
      setForm(emptyForm);
      setMessage('Proposal created');
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to create proposal');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this proposal?')) return;
    await apiRequest(`${basePath}/${id}`, { method: 'DELETE' });
    await load();
  };

  const convertToClient = async (id: string) => {
    await apiRequest(`/admin/proposals/${id}/convert-to-client`, { method: 'POST' });
    setMessage('Proposal converted into a client account');
    await load();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10"><FileText className="h-4 w-4 text-primary" /></div>
            <h1>{admin ? 'SaaS Proposals' : 'Proposals'}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{admin ? 'Create SaaS sales proposals and convert accepted deals into client accounts.' : 'Create customer proposals linked to your own sales work.'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
        </Button>
      </div>

      {(error || message) && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {error || message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Metric label="Total Proposals" value={totals.count.toString()} />
        <Metric label="Accepted" value={totals.accepted.toString()} />
        <Metric label="Pipeline Value" value={`$${totals.value.toLocaleString()}`} />
      </div>

      <Card className="p-0">
        <CardHeader>
          <CardTitle className="text-base">Create Proposal</CardTitle>
          <CardDescription>Line-item totals and proposal discounts are stored in the backend.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createProposal} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="Title"><Input required value={form.title} onChange={event => set('title', event.target.value)} /></Field>
            <Field label="Recipient"><Input required value={form.recipientName} onChange={event => set('recipientName', event.target.value)} /></Field>
            <Field label="Email"><Input type="email" value={form.recipientEmail} onChange={event => set('recipientEmail', event.target.value)} /></Field>
            <Field label="Company"><Input value={form.companyName} onChange={event => set('companyName', event.target.value)} /></Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={value => set('status', value as ProposalStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['draft', 'sent', 'viewed', 'accepted', 'declined', 'expired'].map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Line Item"><Input value={form.itemName} onChange={event => set('itemName', event.target.value)} placeholder="Service package" /></Field>
            <Field label="Quantity"><Input type="number" min="1" value={form.quantity} onChange={event => set('quantity', event.target.value)} /></Field>
            <Field label="Unit Price"><Input type="number" min="0" value={form.unitPrice} onChange={event => set('unitPrice', event.target.value)} /></Field>
            <Field label="Discount Type">
              <Select value={form.discountType} onValueChange={value => set('discountType', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="percent">Percent</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Discount"><Input type="number" min="0" value={form.discountValue} onChange={event => set('discountValue', event.target.value)} /></Field>
            <Field label="Valid Until"><Input type="date" value={form.validUntil} onChange={event => set('validUntil', event.target.value)} /></Field>
            <div className="md:col-span-4 space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={event => set('notes', event.target.value)} />
            </div>
            <div className="md:col-span-4">
              <Button type="submit" disabled={saving}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />{saving ? 'Creating...' : 'Create Proposal'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground">Proposal</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground">Recipient</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-right text-xs text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {proposals.map(proposal => (
                <tr key={proposal.id}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{proposal.title}</p>
                    <p className="text-xs text-muted-foreground">{proposal.companyName || 'No company'} · {new Date(proposal.createdAt).toLocaleDateString()}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">{proposal.recipientName || proposal.recipientEmail || 'No recipient'}</td>
                  <td className="px-4 py-3"><StatusBadge status={proposal.status} /></td>
                  <td className="px-4 py-3 text-sm font-semibold">${Number(proposal.total).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {admin && proposal.status === 'accepted' && (
                        <Button size="sm" variant="outline" onClick={() => void convertToClient(proposal.id)}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Convert
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => void remove(proposal.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && proposals.length === 0 && <Empty label="No proposals yet" />}
          {loading && <Empty label="Loading proposals..." />}
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-0">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function StatusBadge({ status }: { status: ProposalStatus }) {
  return <span className="inline-flex rounded-full border border-border bg-muted px-2 py-1 text-xs capitalize">{status}</span>;
}

function Empty({ label }: { label: string }) {
  return <div className="py-12 text-center text-sm text-muted-foreground">{label}</div>;
}

function normalizeProposal(proposal: Proposal): Proposal {
  return {
    ...proposal,
    subtotal: Number(proposal.subtotal),
    discountValue: Number(proposal.discountValue ?? 0),
    total: Number(proposal.total),
    lineItems: (proposal.lineItems ?? []).map(item => ({ ...item, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), total: Number(item.total) })),
  };
}
