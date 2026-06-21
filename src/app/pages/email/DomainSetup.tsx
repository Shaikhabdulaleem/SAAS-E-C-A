import { useEffect, useState, type ReactNode } from 'react';
import { Globe, Plus, RefreshCw, Settings2, ShieldCheck, ShieldX, Trash2, X } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { DnsRecordsTable, type DnsRecordRow } from '../cold-email/DnsRecordsTable';

interface SendingDomain {
  id: string;
  domain: string;
  dkimSelector: string | null;
  dkimType: string | null;
  dkimHost: string | null;
  dkimValue: string | null;
  spfStatus: string;
  dkimStatus: string;
  dmarcStatus: string;
  mxStatus: string;
  trackingDomain: string | null;
  trackingCnameValue: string | null;
  trackingDomainActive: boolean;
  lastCheckedAt: string | null;
  dnsRecords: DnsRecordRow[];
}

const emptyDnsForm = {
  dkimSelector: '',
  dkimType: 'TXT',
  dkimHost: '',
  dkimValue: '',
  trackingDomain: '',
  trackingCnameValue: '',
};

function allVerified(domain: SendingDomain) {
  return [domain.spfStatus, domain.dkimStatus, domain.dmarcStatus, domain.mxStatus].every(status => status === 'verified');
}

function statusIcon(status: string) {
  return status === 'verified' ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : <ShieldX className="h-4 w-4 text-muted-foreground" />;
}

export function DomainSetup() {
  const [domains, setDomains] = useState<SendingDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState<string | null>(null);
  const [editingDomain, setEditingDomain] = useState<SendingDomain | null>(null);
  const [dnsForm, setDnsForm] = useState(emptyDnsForm);

  const fetchDomains = async () => {
    try {
      setDomains(await apiRequest<SendingDomain[]>('/email/domains'));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load domains');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchDomains(); }, []);

  const addDomain = async () => {
    if (!newDomain.trim()) { setError('Domain is required'); return; }
    try {
      const domain = await apiRequest<SendingDomain>('/email/domains', {
        method: 'POST',
        body: JSON.stringify({ domain: newDomain.trim() }),
      });
      setDomains(prev => [domain, ...prev]);
      setNewDomain('');
      setShowAdd(false);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add domain');
    }
  };

  const verifyDomain = async (domainId: string) => {
    setVerifying(domainId);
    try {
      const updated = await apiRequest<SendingDomain>(`/email/domains/${domainId}/verify`, { method: 'POST' });
      setDomains(prev => prev.map(domain => domain.id === domainId ? updated : domain));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify DNS');
    } finally {
      setVerifying(null);
    }
  };

  const openEditor = (domain: SendingDomain) => {
    setEditingDomain(domain);
    setDnsForm({
      dkimSelector: domain.dkimSelector ?? '',
      dkimType: domain.dkimType ?? 'TXT',
      dkimHost: domain.dkimHost ?? '',
      dkimValue: domain.dkimValue ?? '',
      trackingDomain: domain.trackingDomain ?? '',
      trackingCnameValue: domain.trackingCnameValue ?? '',
    });
  };

  const saveDns = async () => {
    if (!editingDomain) return;
    try {
      const updated = await apiRequest<SendingDomain>(`/email/domains/${editingDomain.id}/dns-records`, {
        method: 'PATCH',
        body: JSON.stringify(dnsForm),
      });
      setDomains(prev => prev.map(domain => domain.id === editingDomain.id ? updated : domain));
      setEditingDomain(null);
      setDnsForm(emptyDnsForm);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save DNS records');
    }
  };

  const deleteDomain = async (domainId: string) => {
    if (!window.confirm('Delete this sending domain?')) return;
    await apiRequest(`/email/domains/${domainId}`, { method: 'DELETE' });
    setDomains(prev => prev.filter(domain => domain.id !== domainId));
  };

  const verified = domains.filter(allVerified).length;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>}
      {showAdd && (
        <Modal title="Add Sending Domain" onClose={() => setShowAdd(false)}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Domain</Label>
              <Input placeholder="company.com" value={newDomain} onChange={event => setNewDomain(event.target.value)} />
              <p className="text-xs text-muted-foreground">Use the same domain as the sender email, for example jawad@company.com.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" onClick={addDomain}><Plus className="mr-1.5 h-3.5 w-3.5" /> Add Domain</Button>
            </div>
          </div>
        </Modal>
      )}
      {editingDomain && (
        <Modal title="DNS Records" subtitle={editingDomain.domain} onClose={() => setEditingDomain(null)}>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="DKIM Selector" value={dnsForm.dkimSelector} onChange={value => setDnsForm(f => ({ ...f, dkimSelector: value }))} placeholder="default, google, s1" />
              <Field label="DKIM Type" value={dnsForm.dkimType} onChange={value => setDnsForm(f => ({ ...f, dkimType: value }))} placeholder="TXT or CNAME" />
            </div>
            <Field label="DKIM Host" value={dnsForm.dkimHost} onChange={value => setDnsForm(f => ({ ...f, dkimHost: value }))} placeholder={`default._domainkey.${editingDomain.domain}`} />
            <Field label="DKIM Value" value={dnsForm.dkimValue} onChange={value => setDnsForm(f => ({ ...f, dkimValue: value }))} placeholder="Paste provider-generated DKIM value" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tracking Host" value={dnsForm.trackingDomain} onChange={value => setDnsForm(f => ({ ...f, trackingDomain: value }))} placeholder={`track.${editingDomain.domain}`} />
              <Field label="Tracking CNAME Value" value={dnsForm.trackingCnameValue} onChange={value => setDnsForm(f => ({ ...f, trackingCnameValue: value }))} placeholder="sendgrid.net" />
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" size="sm" onClick={() => setEditingDomain(null)}>Cancel</Button>
              <Button size="sm" onClick={saveDns}>Save DNS Records</Button>
            </div>
          </div>
        </Modal>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground">Domain Setup</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Verify SPF, DKIM, DMARC, and MX before sending marketing campaigns.</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="mr-1.5 h-4 w-4" /> Add Domain</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Domains" value={domains.length.toString()} />
        <Stat label="Verified" value={verified.toString()} />
        <Stat label="Needs Setup" value={(domains.length - verified).toString()} />
      </div>

      {loading ? (
        <Card><CardContent className="py-14 text-center text-sm text-muted-foreground">Loading domains...</CardContent></Card>
      ) : domains.length === 0 ? (
        <Card><CardContent className="py-14 text-center"><Globe className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No sending domains configured.</p><Button className="mt-4" size="sm" onClick={() => setShowAdd(true)}>Add Domain</Button></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {domains.map(domain => (
            <Card key={domain.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-base">{domain.domain}</CardTitle>
                    <CardDescription>{domain.lastCheckedAt ? `Last checked ${new Date(domain.lastCheckedAt).toLocaleString()}` : 'DNS has not been verified yet'}</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className={allVerified(domain) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>{allVerified(domain) ? 'Verified' : 'Setup Required'}</Badge>
                    <Button variant="outline" size="sm" onClick={() => openEditor(domain)}><Settings2 className="mr-1.5 h-3.5 w-3.5" /> DNS</Button>
                    <Button variant="outline" size="sm" onClick={() => verifyDomain(domain.id)} disabled={verifying === domain.id}><RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${verifying === domain.id ? 'animate-spin' : ''}`} /> Verify</Button>
                    <Button variant="outline" size="sm" onClick={() => deleteDomain(domain.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {(['spfStatus', 'dkimStatus', 'dmarcStatus', 'mxStatus'] as const).map(key => (
                    <div key={key} className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                      {statusIcon(domain[key])}
                      <span className="uppercase">{key.replace('Status', '')}</span>
                    </div>
                  ))}
                </div>
                <DnsRecordsTable records={domain.dnsRecords ?? []} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Modal({ title, subtitle, children, onClose }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div><h2 className="text-base font-semibold">{title}</h2>{subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}</div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-semibold text-foreground">{value}</p></CardContent></Card>;
}
