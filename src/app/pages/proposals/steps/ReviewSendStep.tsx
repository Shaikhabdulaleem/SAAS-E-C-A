import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CheckCircle2, Download, Eye, Loader2, Send } from 'lucide-react';
import { apiRequest, downloadPdfBlob } from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { useProposalForm } from '../ProposalFormContext';
import { ProposalStatusBadge } from '../components/ProposalStatusBadge';

export function ReviewSendStep() {
  const navigate = useNavigate();
  const { state, setState, saveDraft, admin } = useProposalForm();
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const opts = state.sendOptions;
  const basePath = admin ? '/admin/proposals' : '/proposals';
  const listPath = admin ? '/mcc/proposals' : '/proposals';

  const set = (field: keyof typeof opts, value: string | number | boolean) => {
    setState((prev) => ({ ...prev, sendOptions: { ...prev.sendOptions, [field]: value } }));
  };

  const services = state.selectedServices;
  const serviceTotal = services.reduce((sum, s) => sum + s.finalPrice, 0);

  const validation = {
    hasTitle: !!state.recipientInfo.title,
    hasRecipient: !!state.recipientInfo.recipientName,
    hasServices: services.length > 0,
    hasEmail: !!opts.toEmail,
    hasSubject: !!opts.subject,
  };
  const isValid = Object.values(validation).every(Boolean);

  const handleGeneratePdf = async () => {
    if (!state.proposalId) {
      await saveDraft();
    }
    setGenerating(true);
    setError('');
    try {
      await apiRequest(`${basePath}/${state.proposalId}/generate-pdf`, { method: 'POST' });
      await downloadPdfBlob(`${basePath}/${state.proposalId}/download-pdf`, `proposal-${state.proposalId}.pdf`);
      setMessage('PDF generated and downloaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!state.proposalId) {
      await saveDraft();
    }
    setSending(true);
    setError('');
    try {
      await apiRequest(`${basePath}/${state.proposalId}/generate-pdf`, { method: 'POST' });
      await apiRequest(`${basePath}/${state.proposalId}/send`, {
        method: 'POST',
        body: JSON.stringify({
          toEmail: opts.toEmail,
          ccEmail: opts.ccEmail || undefined,
          subject: opts.subject,
          message: opts.message || `We've prepared a proposal for you. Please review at your convenience.`,
        }),
      });
      setMessage('Proposal sent successfully!');
      setTimeout(() => navigate(listPath), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send proposal');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Proposal Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Title:</span>
                <p className="font-medium">{state.recipientInfo.title || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Recipient:</span>
                <p className="font-medium">{state.recipientInfo.recipientName || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Company:</span>
                <p className="font-medium">{state.recipientInfo.companyName || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Total Value:</span>
                <p className="font-medium text-primary">${serviceTotal.toLocaleString()}/mo</p>
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground mb-2">Services ({services.length})</p>
              {services.map((s) => (
                <div key={s.serviceType} className="flex justify-between py-1 text-sm">
                  <span className="capitalize">{s.serviceType.replace(/_/g, ' ')} — {s.planName}</span>
                  <span className="font-medium">${s.finalPrice.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Checklist</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { label: 'Proposal title set', ok: validation.hasTitle },
                { label: 'Recipient name provided', ok: validation.hasRecipient },
                { label: 'At least one service selected', ok: validation.hasServices },
                { label: 'Recipient email for delivery', ok: validation.hasEmail },
                { label: 'Email subject line set', ok: validation.hasSubject },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className={`h-4 w-4 ${item.ok ? 'text-emerald-500' : 'text-muted-foreground/30'}`} />
                  <span className={item.ok ? '' : 'text-muted-foreground'}>{item.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Email Delivery</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>To Email *</Label>
                <Input
                  type="email"
                  placeholder="recipient@company.com"
                  value={opts.toEmail}
                  onChange={(e) => set('toEmail', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>CC Email</Label>
                <Input
                  type="email"
                  placeholder="cc@company.com"
                  value={opts.ccEmail}
                  onChange={(e) => set('ccEmail', e.target.value)}
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label>Subject *</Label>
                <Input
                  placeholder="Proposal: Your Growth Package"
                  value={opts.subject}
                  onChange={(e) => set('subject', e.target.value)}
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label>Message</Label>
                <Textarea
                  rows={3}
                  placeholder="A personal message to include in the email..."
                  value={opts.message}
                  onChange={(e) => set('message', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Follow-up Reminder (days)</Label>
                <Select value={String(opts.followUpDays)} onValueChange={(v) => set('followUpDays', Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">No follow-up</SelectItem>
                    <SelectItem value="3">After 3 days</SelectItem>
                    <SelectItem value="5">After 5 days</SelectItem>
                    <SelectItem value="7">After 7 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {(error || message) && (
          <div className={`rounded-lg border px-3 py-2 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
            {error || message}
          </div>
        )}

        <Card>
          <CardContent className="pt-6 space-y-3">
            <Button className="w-full" variant="outline" onClick={() => void saveDraft()}>
              Save as Draft
            </Button>
            <Button className="w-full" variant="outline" onClick={() => void handleGeneratePdf()} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              {generating ? 'Generating...' : 'Generate PDF'}
            </Button>
            <Button className="w-full" onClick={() => void handleSend()} disabled={!isValid || sending}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {sending ? 'Sending...' : 'Send Proposal'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
