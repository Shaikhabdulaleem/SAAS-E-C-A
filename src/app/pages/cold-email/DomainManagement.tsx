import { useState, useEffect } from 'react';
import { Plus, Globe, Mail, Users, Zap, ShieldCheck, ShieldX, AlertTriangle, Settings2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Progress } from '../../components/ui/progress';
import { Separator } from '../../components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { apiRequest } from '../../lib/api';

interface ProviderCredential {
  id: string;
  providerType: string;
  isActive: boolean;
}

interface DomainData {
  id: string;
  domain: string;
  targetDailyVolume: number | null;
  requiredMailboxes: number | null;
  currentMailboxes: number;
  activeMailboxes: number;
  readyMailboxes: number;
  warmingMailboxes: number;
  needsMore: boolean;
  shortfall: number;
  healthScore: number;
  spfStatus: string;
  dkimStatus: string;
  dmarcStatus: string;
  mxStatus: string;
  blacklistStatus: string;
  dnsProvider: string | null;
  hasDnsApiKey: boolean;
  providerCredential: ProviderCredential | null;
  createdAt: string;
}

const emailFormatOptions = [
  { value: 'firstname_at', label: 'john@' },
  { value: 'firstname_dot_lastname', label: 'john.carter@' },
  { value: 'firstnamelastname', label: 'johncarter@' },
  { value: 'f_dot_lastname', label: 'j.carter@' },
];

function statusIcon(status: string) {
  if (status === 'verified') return <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />;
  return <ShieldX className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function DomainManagement() {
  const [domains, setDomains] = useState<DomainData[]>([]);
  const [providers, setProviders] = useState<ProviderCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showProvisionDialog, setShowProvisionDialog] = useState<string | null>(null);
  const [showDnsDialog, setShowDnsDialog] = useState<string | null>(null);

  const [newDomain, setNewDomain] = useState('');
  const [newVolume, setNewVolume] = useState(500);
  const [newProviderCredentialId, setNewProviderCredentialId] = useState('');
  const [adding, setAdding] = useState(false);

  const [emailFormat, setEmailFormat] = useState('firstname_dot_lastname');
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('Sales Development Rep');
  const [provisioning, setProvisioning] = useState(false);

  const [dnsProvider, setDnsProvider] = useState('cloudflare');
  const [dnsApiKey, setDnsApiKey] = useState('');
  const [dnsZoneId, setDnsZoneId] = useState('');
  const [configuringDns, setConfiguringDns] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [domainsData, providersData] = await Promise.all([
        apiRequest<DomainData[]>('/provisioning/domains'),
        apiRequest<ProviderCredential[]>('/provisioning/providers'),
      ]);
      setDomains(domainsData);
      setProviders(providersData);
      if (providersData.length > 0) setNewProviderCredentialId(providersData[0].id);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim() || newVolume < 1) return;
    setAdding(true);
    try {
      await apiRequest('/provisioning/domains', {
        method: 'POST',
        body: JSON.stringify({
          domain: newDomain.trim(),
          targetDailyVolume: newVolume,
          providerCredentialId: newProviderCredentialId || undefined,
        }),
      });
      setNewDomain('');
      setNewVolume(500);
      setShowAddDialog(false);
      await fetchData();
    } catch {
    } finally {
      setAdding(false);
    }
  };

  const handleAutoProvision = async (domainId: string) => {
    setProvisioning(true);
    try {
      await apiRequest(`/provisioning/domains/${domainId}/auto-provision`, {
        method: 'POST',
        body: JSON.stringify({ emailFormat, companyName, jobTitle }),
      });
      setShowProvisionDialog(null);
      await fetchData();
    } catch {
    } finally {
      setProvisioning(false);
    }
  };

  const handleConnectDns = async (domainId: string) => {
    setConfiguringDns(true);
    try {
      await apiRequest(`/provisioning/domains/${domainId}/dns/connect`, {
        method: 'POST',
        body: JSON.stringify({ dnsProvider, dnsApiKey, dnsZoneId: dnsProvider === 'cloudflare' ? dnsZoneId : undefined }),
      });
      await apiRequest(`/provisioning/domains/${domainId}/dns/auto-configure`, { method: 'POST' });
      setShowDnsDialog(null);
      setDnsApiKey('');
      setDnsZoneId('');
      await fetchData();
    } catch {
    } finally {
      setConfiguringDns(false);
    }
  };

  const handleUpdateVolume = async (domainId: string, volume: number) => {
    try {
      await apiRequest(`/provisioning/domains/${domainId}/volume`, {
        method: 'PATCH',
        body: JSON.stringify({ targetDailyVolume: volume }),
      });
      await fetchData();
    } catch {
    }
  };

  const totalCapacity = domains.reduce((sum, d) => sum + (d.targetDailyVolume ?? 0), 0);
  const totalMailboxes = domains.reduce((sum, d) => sum + d.currentMailboxes, 0);
  const totalReady = domains.reduce((sum, d) => sum + d.readyMailboxes, 0);
  const domainsNeedingMore = domains.filter(d => d.needsMore).length;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-foreground">Domain Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage domains, set target volumes, and auto-provision mailboxes
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Domain
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Domains', value: domains.length, icon: Globe, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Daily Capacity', value: totalCapacity.toLocaleString(), icon: Mail, color: 'text-sky-600', bg: 'bg-sky-50' },
          { label: 'Total Mailboxes', value: totalMailboxes, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Needs Provisioning', value: domainsNeedingMore, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(stat => (
          <Card key={stat.label} className="p-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-semibold text-foreground">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {providers.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900">No Email Provider Connected</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Connect Google Workspace or Microsoft 365 to auto-create real mailboxes.{' '}
                <a href="/cold-email/provider-connect" className="underline font-medium">Connect now</a>
              </p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <Card><CardContent className="py-16 text-center"><p className="text-sm text-muted-foreground">Loading domains...</p></CardContent></Card>
      ) : domains.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Globe className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No domains configured yet</p>
            <Button size="sm" className="mt-3" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Your First Domain
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {domains.map(domain => {
            const provisionPct = domain.requiredMailboxes
              ? Math.min(100, Math.round((domain.currentMailboxes / domain.requiredMailboxes) * 100))
              : 0;

            return (
              <Card key={domain.id} className="p-0">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{domain.domain}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        {domain.providerCredential && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-emerald-50 text-emerald-700">
                            {domain.providerCredential.providerType === 'google_workspace' ? 'Google' : 'Microsoft 365'}
                          </Badge>
                        )}
                        <Badge variant="secondary" className={`text-[10px] h-4 px-1.5 ${domain.blacklistStatus === 'clean' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          {domain.blacklistStatus === 'clean' ? 'Clean' : 'Blacklisted'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!domain.hasDnsApiKey && (
                        <Button variant="outline" size="sm" onClick={() => setShowDnsDialog(domain.id)}>
                          <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                          Setup DNS
                        </Button>
                      )}
                      {domain.needsMore && domain.providerCredential && (
                        <Button size="sm" onClick={() => setShowProvisionDialog(domain.id)}>
                          <Zap className="h-3.5 w-3.5 mr-1.5" />
                          Auto-Provision ({domain.shortfall} needed)
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Target Volume</p>
                      <p className="text-lg font-semibold text-foreground">{domain.targetDailyVolume?.toLocaleString() ?? '—'}/day</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Required Mailboxes</p>
                      <p className="text-lg font-semibold text-foreground">{domain.requiredMailboxes ?? '—'}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Current Mailboxes</p>
                      <p className="text-lg font-semibold text-foreground">{domain.currentMailboxes}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Ready to Send</p>
                      <p className="text-lg font-semibold text-emerald-600">{domain.readyMailboxes}</p>
                    </div>
                  </div>

                  {domain.requiredMailboxes && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Provisioning Progress</span>
                        <span className="font-medium text-foreground">{domain.currentMailboxes} / {domain.requiredMailboxes} mailboxes</span>
                      </div>
                      <Progress value={provisionPct} className={`h-1.5 ${provisionPct >= 100 ? '[&>[data-slot=progress-indicator]]:bg-emerald-500' : '[&>[data-slot=progress-indicator]]:bg-amber-500'}`} />
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      {statusIcon(domain.spfStatus)}
                      <span className="text-xs text-muted-foreground">SPF</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {statusIcon(domain.dkimStatus)}
                      <span className="text-xs text-muted-foreground">DKIM</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {statusIcon(domain.dmarcStatus)}
                      <span className="text-xs text-muted-foreground">DMARC</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {statusIcon(domain.mxStatus)}
                      <span className="text-xs text-muted-foreground">MX</span>
                    </div>
                    {domain.warmingMailboxes > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-orange-50 text-orange-700 ml-auto">
                        {domain.warmingMailboxes} warming
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Domain Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Domain</DialogTitle>
            <DialogDescription>Add a domain and set your target daily email volume</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Domain</Label>
              <Input placeholder="e.g. company.com" value={newDomain} onChange={e => setNewDomain(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Target Daily Volume</Label>
              <Input type="number" min={1} value={newVolume} onChange={e => setNewVolume(parseInt(e.target.value) || 0)} />
              <p className="text-xs text-muted-foreground">
                {newVolume > 0 && `= ${Math.ceil(newVolume / 50)} mailboxes needed (${newVolume} emails / 50 per mailbox)`}
              </p>
            </div>

            {providers.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm">Email Provider</Label>
                <Select value={newProviderCredentialId} onValueChange={setNewProviderCredentialId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.providerType === 'google_workspace' ? 'Google Workspace' : 'Microsoft 365'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAddDomain} disabled={adding || !newDomain.trim() || newVolume < 1}>
                {adding ? 'Adding...' : 'Add Domain'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Auto-Provision Dialog */}
      <Dialog open={!!showProvisionDialog} onOpenChange={() => setShowProvisionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Auto-Provision Mailboxes</DialogTitle>
            <DialogDescription>
              Create real mailboxes on your email provider and auto-enroll in warmup
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Email Format</Label>
              <Select value={emailFormat} onValueChange={setEmailFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {emailFormatOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Company Name</Label>
              <Input placeholder="Your company" value={companyName} onChange={e => setCompanyName(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Default Job Title</Label>
              <Input placeholder="Sales Development Rep" value={jobTitle} onChange={e => setJobTitle(e.target.value)} />
            </div>

            <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2 text-xs text-indigo-700">
              All new mailboxes will be auto-enrolled in warmup (Week1: 5/day → Week5: 50/day).
              Campaign sending blocked until health score &gt; 80.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowProvisionDialog(null)}>Cancel</Button>
              <Button size="sm" onClick={() => showProvisionDialog && handleAutoProvision(showProvisionDialog)} disabled={provisioning}>
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                {provisioning ? 'Provisioning...' : 'Create Mailboxes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DNS Setup Dialog */}
      <Dialog open={!!showDnsDialog} onOpenChange={() => setShowDnsDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure DNS Records</DialogTitle>
            <DialogDescription>
              Auto-configure SPF, DKIM, DMARC, and MX records via your DNS provider
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">DNS Provider</Label>
              <Select value={dnsProvider} onValueChange={setDnsProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cloudflare">Cloudflare</SelectItem>
                  <SelectItem value="namecheap">Namecheap</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">API Key</Label>
              <Input type="password" placeholder="Your DNS provider API key" value={dnsApiKey} onChange={e => setDnsApiKey(e.target.value)} />
            </div>

            {dnsProvider === 'cloudflare' && (
              <div className="space-y-1.5">
                <Label className="text-sm">Zone ID</Label>
                <Input placeholder="Cloudflare Zone ID" value={dnsZoneId} onChange={e => setDnsZoneId(e.target.value)} />
                <p className="text-xs text-muted-foreground">Found in Cloudflare Dashboard &gt; Your Domain &gt; Overview (right sidebar)</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowDnsDialog(null)}>Cancel</Button>
              <Button
                size="sm"
                onClick={() => showDnsDialog && handleConnectDns(showDnsDialog)}
                disabled={configuringDns || !dnsApiKey.trim() || (dnsProvider === 'cloudflare' && !dnsZoneId.trim())}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${configuringDns ? 'animate-spin' : ''}`} />
                {configuringDns ? 'Configuring...' : 'Auto-Configure DNS'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
