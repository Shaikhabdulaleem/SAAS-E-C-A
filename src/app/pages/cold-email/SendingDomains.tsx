import { useState, useEffect } from 'react';
import { Plus, Globe, Shield, ShieldCheck, ShieldAlert, ShieldX, RefreshCw, Trash2, X, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
import { apiRequest } from '../../lib/api';

interface SendingDomain {
  id: string;
  domain: string;
  spfStatus: 'verified' | 'not_set' | 'error';
  dkimStatus: 'verified' | 'not_set' | 'error';
  dmarcStatus: 'verified' | 'not_set' | 'error';
  mxStatus: 'verified' | 'not_set' | 'error';
  trackingDomain: string | null;
  trackingDomainActive: boolean;
  lastCheckedAt: string | null;
  createdAt: string;
}

const statusIcon = (status: string) => {
  if (status === 'verified') return <ShieldCheck className="h-4 w-4 text-emerald-600" />;
  if (status === 'error') return <ShieldAlert className="h-4 w-4 text-red-500" />;
  return <ShieldX className="h-4 w-4 text-muted-foreground" />;
};

const statusLabel = (status: string) => {
  if (status === 'verified') return 'Verified';
  if (status === 'error') return 'Error';
  return 'Not Set';
};

const statusBadgeClass = (status: string) => {
  if (status === 'verified') return 'bg-emerald-50 text-emerald-700';
  if (status === 'error') return 'bg-red-50 text-red-700';
  return 'bg-muted text-muted-foreground';
};

function allVerified(domain: SendingDomain) {
  return domain.spfStatus === 'verified' && domain.dkimStatus === 'verified' && domain.dmarcStatus === 'verified' && domain.mxStatus === 'verified';
}

function verifiedCount(domain: SendingDomain) {
  return [domain.spfStatus, domain.dkimStatus, domain.dmarcStatus, domain.mxStatus].filter(s => s === 'verified').length;
}

export function SendingDomains() {
  const [domains, setDomains] = useState<SendingDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState<string | null>(null);

  const fetchDomains = async () => {
    try {
      const result = await apiRequest<SendingDomain[]>('/cold-email/domains');
      setDomains(result);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDomains(); }, []);

  const handleAdd = async () => {
    if (!newDomain.trim()) { setError('Domain is required'); return; }
    try {
      const domain = await apiRequest<SendingDomain>('/cold-email/domains', {
        method: 'POST',
        body: JSON.stringify({ domain: newDomain.trim() }),
      });
      setDomains(prev => [domain, ...prev]);
      setShowModal(false);
      setNewDomain('');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add domain');
    }
  };

  const handleVerify = async (domainId: string) => {
    setVerifying(domainId);
    try {
      const updated = await apiRequest<SendingDomain>(`/cold-email/domains/${domainId}/verify`, { method: 'POST' });
      setDomains(prev => prev.map(d => d.id === domainId ? updated : d));
    } catch {
    } finally {
      setVerifying(null);
    }
  };

  const handleDelete = async (domainId: string) => {
    if (!window.confirm('Delete this domain? Mailboxes using it will be unlinked.')) return;
    try {
      await apiRequest(`/cold-email/domains/${domainId}`, { method: 'DELETE' });
      setDomains(prev => prev.filter(d => d.id !== domainId));
    } catch {
    }
  };

  const totalDomains = domains.length;
  const fullyVerified = domains.filter(allVerified).length;
  const needsAttention = domains.filter(d => !allVerified(d)).length;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-md border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground">Add Sending Domain</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Enter the domain you send cold emails from</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Domain</Label>
                <Input
                  placeholder="e.g. company.com"
                  value={newDomain}
                  onChange={e => { setNewDomain(e.target.value); setError(''); }}
                  className={error ? 'border-destructive' : ''}
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
                <p className="text-xs text-muted-foreground">
                  After adding, you'll need to set up SPF, DKIM, and DMARC records with your DNS provider.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAdd}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add Domain
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-foreground">Sending Domains</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage DNS authentication for your cold email domains</p>
        </div>
        <Button size="sm" onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Domain
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Domains', value: totalDomains, icon: Globe, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Fully Verified', value: fullyVerified, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Needs Attention', value: needsAttention, icon: ShieldAlert, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(stat => (
          <Card key={stat.label} className="p-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-semibold text-foreground">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-900">DNS Authentication Required</p>
            <p className="text-xs text-amber-700 mt-0.5">
              All sending domains must have SPF, DKIM, and DMARC records configured before campaigns can send.
              This protects your deliverability and prevents emails from landing in spam.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <Card><CardContent className="py-16 text-center"><p className="text-sm text-muted-foreground">Loading domains...</p></CardContent></Card>
      ) : domains.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Globe className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No sending domains configured</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Add your domain to start verifying DNS records</p>
            <Button size="sm" className="mt-4" onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Domain
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {domains.map(domain => (
            <Card key={domain.id} className="p-0">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${allVerified(domain) ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                      {allVerified(domain)
                        ? <ShieldCheck className="h-5 w-5 text-emerald-600" />
                        : <ShieldAlert className="h-5 w-5 text-amber-600" />
                      }
                    </div>
                    <div>
                      <CardTitle className="text-base">{domain.domain}</CardTitle>
                      <CardDescription>
                        {verifiedCount(domain)}/4 records verified
                        {domain.lastCheckedAt && ` · Last checked ${new Date(domain.lastCheckedAt).toLocaleDateString()}`}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVerify(domain.id)}
                      disabled={verifying === domain.id}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${verifying === domain.id ? 'animate-spin' : ''}`} />
                      {verifying === domain.id ? 'Checking...' : 'Verify DNS'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(domain.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: 'SPF Record', status: domain.spfStatus, hint: 'Authorizes sending servers' },
                    { label: 'DKIM Record', status: domain.dkimStatus, hint: 'Cryptographic email signing' },
                    { label: 'DMARC Record', status: domain.dmarcStatus, hint: 'Alignment policy' },
                    { label: 'MX Record', status: domain.mxStatus, hint: 'Mail exchange routing' },
                  ].map(record => (
                    <div key={record.label} className={`rounded-lg border p-3 ${record.status === 'verified' ? 'border-emerald-200 bg-emerald-50/50' : record.status === 'error' ? 'border-red-200 bg-red-50/50' : 'border-border bg-muted/30'}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        {statusIcon(record.status)}
                        <span className="text-sm font-medium text-foreground">{record.label}</span>
                      </div>
                      <Badge variant="secondary" className={`text-[10px] h-4 px-1.5 ${statusBadgeClass(record.status)}`}>
                        {statusLabel(record.status)}
                      </Badge>
                      <p className="text-[10px] text-muted-foreground mt-1.5">{record.hint}</p>
                    </div>
                  ))}
                </div>
                {domain.trackingDomain && (
                  <>
                    <Separator className="my-3" />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Custom Tracking Domain</p>
                        <p className="text-xs text-muted-foreground">{domain.trackingDomain}</p>
                      </div>
                      <Badge variant="secondary" className={`text-xs ${domain.trackingDomainActive ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                        {domain.trackingDomainActive ? 'Active' : 'Not Connected'}
                      </Badge>
                    </div>
                  </>
                )}
                {!allVerified(domain) && (
                  <>
                    <Separator className="my-3" />
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs font-medium text-foreground mb-2">Setup Instructions</p>
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        {domain.spfStatus !== 'verified' && (
                          <p>SPF: Add a TXT record: <code className="text-[10px] bg-background px-1 py-0.5 rounded border">v=spf1 include:_spf.{domain.domain} ~all</code></p>
                        )}
                        {domain.dkimStatus !== 'verified' && (
                          <p>DKIM: Add a CNAME record for <code className="text-[10px] bg-background px-1 py-0.5 rounded border">default._domainkey.{domain.domain}</code></p>
                        )}
                        {domain.dmarcStatus !== 'verified' && (
                          <p>DMARC: Add a TXT record at <code className="text-[10px] bg-background px-1 py-0.5 rounded border">_dmarc.{domain.domain}</code>: <code className="text-[10px] bg-background px-1 py-0.5 rounded border">v=DMARC1; p=quarantine;</code></p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
