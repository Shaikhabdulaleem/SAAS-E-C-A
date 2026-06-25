import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { ShoppingCart, Globe, CheckCircle, XCircle, Loader2, ArrowRight, ArrowLeft, DollarSign, Mail, Flame, HeartPulse, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Checkbox } from '../../components/ui/checkbox';
import { Progress } from '../../components/ui/progress';
import { apiRequest } from '../../lib/api';

interface DomainLineItem {
  domain: string;
  tld: string;
  available: boolean | null;
  price: number | null;
  selected: boolean;
  purchaseStatus: string;
  dnsStatus: string;
  mailboxStatus: string;
  warmupStatus: string;
  purchaseError?: string;
  dnsError?: string;
  mailboxError?: string;
}

interface PurchaseOrder {
  id: string;
  baseName: string;
  quantity: number;
  status: string;
  domains: DomainLineItem[];
  totalCost: number;
  registrarProvider: string;
  completedAt?: string;
}

interface ConnectedRegistrar {
  provider: string;
  connectedAt: string;
}

interface Provider {
  id: string;
  providerType: string;
  isActive: boolean;
}

const tldColors: Record<string, string> = {
  com: 'bg-blue-50 text-blue-700',
  io: 'bg-purple-50 text-purple-700',
  co: 'bg-emerald-50 text-emerald-700',
  net: 'bg-amber-50 text-amber-700',
  org: 'bg-pink-50 text-pink-700',
};

const statusSteps = [
  { key: 'purchaseStatus', label: 'Purchase', done: 'purchased' },
  { key: 'dnsStatus', label: 'DNS', done: 'records_created' },
  { key: 'mailboxStatus', label: 'Mailbox', done: 'created' },
  { key: 'warmupStatus', label: 'Warmup', done: 'enrolled' },
];

export function DomainPurchase() {
  const [step, setStep] = useState(1);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [baseName, setBaseName] = useState('');
  const [quantity, setQuantity] = useState('5');
  const [mailboxesPerDomain, setMailboxesPerDomain] = useState('1');
  const [registrar, setRegistrar] = useState('');
  const [emailFormat, setEmailFormat] = useState('firstname.lastname');
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('Sales Development Rep');
  const [providerId, setProviderId] = useState('');
  const [registrars, setRegistrars] = useState<ConnectedRegistrar[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    Promise.all([
      apiRequest<ConnectedRegistrar[]>('/provisioning/domain-purchase/registrars').catch(() => []),
      apiRequest<Provider[]>('/provisioning/providers').catch(() => []),
    ]).then(([r, p]) => {
      const regs = Array.isArray(r) ? r : [];
      setRegistrars(regs);
      if (regs.length > 0) setRegistrar(regs[0].provider);
      setProviders(Array.isArray(p) ? p : []);
      const m365 = (Array.isArray(p) ? p : []).find((pr) => pr.providerType === 'microsoft_365' && pr.isActive);
      if (m365) setProviderId(m365.id);
    });
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const pollOrder = (id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const o = await apiRequest<PurchaseOrder>(`/provisioning/domain-purchase/orders/${id}`);
        setOrder(o);
        if (o.status === 'awaiting_confirmation') { clearInterval(pollRef.current!); setStep(3); }
        if (o.status === 'completed' || o.status === 'failed') { clearInterval(pollRef.current!); setStep(5); }
        if (['purchasing', 'setting_nameservers', 'configuring_dns', 'creating_mailboxes', 'warming_up'].includes(o.status)) setStep(4);
      } catch (err) { console.error('Polling order failed:', err instanceof Error ? err.message : err); }
    }, 3000);
  };

  const handleCreate = async () => {
    if (!baseName.trim() || !registrar) return;
    setLoading(true); setError('');
    try {
      const o = await apiRequest<PurchaseOrder>('/provisioning/domain-purchase/orders', {
        method: 'POST',
        body: JSON.stringify({ baseName, quantity: Number(quantity), mailboxesPerDomain: Number(mailboxesPerDomain), registrarProvider: registrar, emailFormat, companyName: companyName || undefined, jobTitle, providerCredentialId: providerId || undefined }),
      });
      setOrderId(o.id); setOrder(o); setStep(2); pollOrder(o.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    if (!order) return;
    const selected = order.domains.filter((d) => d.selected && d.available).map((d) => d.domain);
    if (selected.length === 0) return;
    setLoading(true);
    try {
      const o = await apiRequest<PurchaseOrder>(`/provisioning/domain-purchase/orders/${order.id}/confirm`, {
        method: 'POST', body: JSON.stringify({ selectedDomains: selected }),
      });
      setOrder(o); setStep(4); pollOrder(order.id);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  };

  const toggleDomain = (domain: string) => {
    if (!order) return;
    setOrder({ ...order, domains: order.domains.map((d) => d.domain === domain ? { ...d, selected: !d.selected } : d) });
  };

  const availableDomains = order?.domains.filter((d) => d.available) ?? [];
  const selectedDomains = order?.domains.filter((d) => d.selected && d.available) ?? [];
  const totalCost = selectedDomains.reduce((sum, d) => sum + (d.price ?? 0), 0);

  const purchasedDomains = order?.domains.filter((d) => d.purchaseStatus === 'purchased') ?? [];
  const pipelineProgress = purchasedDomains.length > 0
    ? purchasedDomains.reduce((sum, d) => {
        let done = 0;
        if (d.purchaseStatus === 'purchased') done++;
        if (['records_created', 'verified', 'nameservers_set', 'zone_created'].includes(d.dnsStatus)) done++;
        if (d.mailboxStatus === 'created') done++;
        if (d.warmupStatus === 'enrolled') done++;
        return sum + (done / 4) * 100;
      }, 0) / purchasedDomains.length
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2"><ShoppingCart className="h-5 w-5" />Buy Domains</h1>
        <p className="text-sm text-muted-foreground mt-1">Purchase domains, configure DNS, create mailboxes, and start warmup — all automated.</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1">
        {['Setup', 'Checking', 'Select', 'Pipeline', 'Complete'].map((label, i) => (
          <div key={i} className="flex items-center flex-1">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium w-full ${step === i + 1 ? 'bg-primary text-primary-foreground' : step > i + 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
              <span className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${step > i + 1 ? 'bg-emerald-500 text-white' : 'bg-white/20'}`}>
                {step > i + 1 ? <CheckCircle className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < 4 && <ArrowRight className="h-4 w-4 text-muted-foreground mx-1 shrink-0" />}
          </div>
        ))}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</div>}

      {/* Step 1: Setup */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Domain Setup</CardTitle><CardDescription>Enter a base name and we'll generate domain variations, check availability, and handle everything.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Base Name *</Label>
                <Input placeholder="e.g. Shayan" value={baseName} onChange={(e) => setBaseName(e.target.value)} />
                <p className="text-xs text-muted-foreground">We'll generate variations like shayanmail.com, getshayanreach.io, etc.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Domains</Label>
                <Select value={quantity} onValueChange={setQuantity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['3', '5', '10', '15', '20'].map((n) => <SelectItem key={n} value={n}>{n} domains</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Mailboxes per Domain</Label>
                <Select value={mailboxesPerDomain} onValueChange={setMailboxesPerDomain}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['1', '2', '3', '5'].map((n) => <SelectItem key={n} value={n}>{n} mailbox{n !== '1' ? 'es' : ''}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{Number(quantity) * Number(mailboxesPerDomain)} total mailboxes = {Number(quantity) * Number(mailboxesPerDomain) * 50} emails/day at full warmup</p>
              </div>
              <div className="space-y-1.5">
                <Label>Domain Registrar *</Label>
                <Select value={registrar} onValueChange={setRegistrar}>
                  <SelectTrigger><SelectValue placeholder="Select registrar" /></SelectTrigger>
                  <SelectContent>
                    {registrars.map((r) => <SelectItem key={r.provider} value={r.provider}>{r.provider.charAt(0).toUpperCase() + r.provider.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
                {registrars.length === 0 && <p className="text-xs text-amber-600">No registrars connected. Go to Settings &gt; Integrations.</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Email Format</Label>
                <Select value={emailFormat} onValueChange={setEmailFormat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="firstname.lastname">firstname.lastname@</SelectItem>
                    <SelectItem value="firstname">firstname@</SelectItem>
                    <SelectItem value="firstnamelastname">firstnamelastname@</SelectItem>
                    <SelectItem value="f.lastname">f.lastname@</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Company Name</Label>
                <Input placeholder="Optional" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Job Title</Label>
                <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
              </div>
              {providers.filter((p) => p.providerType === 'microsoft_365').length > 0 && (
                <div className="space-y-1.5">
                  <Label>Microsoft 365 Provider</Label>
                  <Select value={providerId} onValueChange={setProviderId}>
                    <SelectTrigger><SelectValue placeholder="Select M365" /></SelectTrigger>
                    <SelectContent>{providers.filter((p) => p.providerType === 'microsoft_365').map((p) => <SelectItem key={p.id} value={p.id}>Microsoft 365</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <Button onClick={() => void handleCreate()} disabled={loading || !baseName.trim() || !registrar} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              {loading ? 'Generating...' : 'Generate & Check Availability'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Checking */}
      {step === 2 && (
        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
            <h2 className="text-lg font-semibold">Checking Domain Availability</h2>
            <p className="text-sm text-muted-foreground">Generating variations for "{baseName}" and checking across .com, .io, .co, .net, .org...</p>
            <Progress value={33} className="max-w-xs mx-auto" />
          </CardContent>
        </Card>
      )}

      {/* Step 3: Select Domains */}
      {step === 3 && order && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div><CardTitle className="text-base">Available Domains</CardTitle><CardDescription>{availableDomains.length} available out of {order.domains.length} checked</CardDescription></div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Selected: {selectedDomains.length}</p>
                  <p className="text-lg font-semibold text-primary">${totalCost.toFixed(2)}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {order.domains.filter((d) => d.available).map((d) => (
                  <div key={d.domain} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${d.selected ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <Checkbox checked={d.selected} onCheckedChange={() => toggleDomain(d.domain)} />
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm flex-1">{d.domain}</span>
                    <Badge variant="secondary" className={`text-xs ${tldColors[d.tld] ?? 'bg-muted'}`}>.{d.tld}</Badge>
                    <span className="text-sm font-medium">${d.price?.toFixed(2) ?? '—'}</span>
                  </div>
                ))}
                {order.domains.filter((d) => !d.available).length > 0 && (
                  <details className="mt-4">
                    <summary className="text-xs text-muted-foreground cursor-pointer">Show {order.domains.filter((d) => !d.available).length} unavailable domains</summary>
                    <div className="mt-2 space-y-1">
                      {order.domains.filter((d) => !d.available).map((d) => (
                        <div key={d.domain} className="flex items-center gap-3 p-2 rounded opacity-40">
                          <XCircle className="h-4 w-4 text-red-400" />
                          <span className="text-sm line-through">{d.domain}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-1.5" />Back</Button>
            <Button onClick={() => void handleConfirm()} disabled={loading || selectedDomains.length === 0}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <DollarSign className="h-4 w-4 mr-2" />}
              Purchase {selectedDomains.length} Domains (${totalCost.toFixed(2)})
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Pipeline Progress */}
      {step === 4 && order && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pipeline in Progress</CardTitle>
              <CardDescription>Status: {order.status.replace(/_/g, ' ')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={pipelineProgress} className="mb-6" />
              <div className="space-y-3">
                {purchasedDomains.map((d) => (
                  <div key={d.domain} className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Globe className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{d.domain}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {statusSteps.map((s) => {
                        const val = (d as any)[s.key];
                        const isDone = val === s.done || val === 'verified' || val === 'nameservers_set' || val === 'zone_created';
                        const isFailed = val === 'failed';
                        const isPending = val === 'pending';
                        return (
                          <div key={s.key} className={`text-center p-2 rounded text-xs ${isDone ? 'bg-emerald-50 text-emerald-700' : isFailed ? 'bg-red-50 text-red-700' : isPending ? 'bg-muted text-muted-foreground' : 'bg-amber-50 text-amber-700'}`}>
                            {isDone ? <CheckCircle className="h-3.5 w-3.5 mx-auto mb-1" /> : isFailed ? <XCircle className="h-3.5 w-3.5 mx-auto mb-1" /> : <Loader2 className="h-3.5 w-3.5 mx-auto mb-1 animate-spin" />}
                            {s.label}
                          </div>
                        );
                      })}
                    </div>
                    {(d.purchaseError || d.dnsError || d.mailboxError) && (
                      <p className="text-xs text-red-600 mt-2">{d.purchaseError || d.dnsError || d.mailboxError}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 5: Complete */}
      {step === 5 && order && (
        <div className="space-y-4">
          <Card className={order.status === 'completed' ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'}>
            <CardContent className="py-10 text-center space-y-4">
              {order.status === 'completed' ? <CheckCircle className="h-12 w-12 mx-auto text-emerald-500" /> : <XCircle className="h-12 w-12 mx-auto text-red-500" />}
              <h2 className="text-xl font-semibold">{order.status === 'completed' ? 'Pipeline Complete!' : 'Pipeline Failed'}</h2>
              {order.status === 'completed' && (
                <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                  <div className="text-center"><p className="text-2xl font-bold text-primary">{purchasedDomains.length}</p><p className="text-xs text-muted-foreground">Domains</p></div>
                  <div className="text-center"><p className="text-2xl font-bold text-primary">{order.domains.filter((d) => d.mailboxStatus === 'created').length}</p><p className="text-xs text-muted-foreground">Mailboxes</p></div>
                  <div className="text-center"><p className="text-2xl font-bold text-primary">{order.domains.filter((d) => d.warmupStatus === 'enrolled').length}</p><p className="text-xs text-muted-foreground">Warming Up</p></div>
                </div>
              )}
              {order.lastError && <p className="text-sm text-red-600">{order.lastError}</p>}
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" size="sm" asChild><Link to="/cold-email/personas"><Mail className="h-4 w-4 mr-1.5" />Personas</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/cold-email/domain-health"><HeartPulse className="h-4 w-4 mr-1.5" />Domain Health</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/cold-email/warmup"><Flame className="h-4 w-4 mr-1.5" />Warmup</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/cold-email/mailboxes"><Mail className="h-4 w-4 mr-1.5" />Mailboxes</Link></Button>
          </div>
          <Button variant="outline" className="w-full" onClick={() => { setStep(1); setOrder(null); setOrderId(null); }}>Start New Purchase</Button>
        </div>
      )}
    </div>
  );
}
