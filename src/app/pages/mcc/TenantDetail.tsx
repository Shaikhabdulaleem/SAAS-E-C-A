import { useParams, useNavigate, Link } from 'react-router';
import {
  useTenants, INTEGRATION_PLATFORMS,
  type ServiceKey, type PlanKey, type TenantStatus, type IntegrationPlatformKey, type Tenant,
} from '../../contexts/TenantContext';
import {
  ArrowLeft, Building2, Mail, Phone, Globe, Calendar, Users, DollarSign,
  CheckCircle2, Clock, AlertCircle, XCircle, Save, Trash2, ShieldCheck,
  Plus, X, Eye, EyeOff, TrendingDown, Plug, ToggleLeft, ToggleRight, ExternalLink,
  UserPlus, KeyRound, Copy, Send,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Separator } from '../../components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';

const statusConfig: Record<TenantStatus, { label: string; icon: React.ElementType; className: string }> = {
  active: { label: 'Active', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  trial: { label: 'Trial', icon: Clock, className: 'bg-sky-50 text-sky-700 border-sky-200' },
  suspended: { label: 'Suspended', icon: AlertCircle, className: 'bg-amber-50 text-amber-700 border-amber-200' },
  cancelled: { label: 'Cancelled', icon: XCircle, className: 'bg-red-50 text-red-700 border-red-200' },
};

const emptyIntForm = {
  platformKey: '' as IntegrationPlatformKey | '',
  customName: '',
  apiKey: '',
  monthlyPrice: '',
  notes: '',
};

interface TenantAccess {
  owner: { user: { name: string; email: string }; role: string; createdAt: string } | null;
  pendingInvites: Array<{ id: string; email: string; role: string; expiresAt: string; createdAt: string }>;
  loginUrl: string;
  email: string;
  enabledServices: string[];
  lastInviteAt: string | null;
  lastResetAt: string | null;
}

interface InviteResult {
  email: string;
  role: string;
  expiresAt: string;
  inviteUrl: string;
  loginUrl: string;
}

interface OwnerLoginResult {
  loginUrl: string;
  email: string;
  temporaryPassword?: string;
  role: string;
  tenantName: string;
  enabledServices: string[];
}

export function TenantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tenants, plans, services, updateTenant, deleteTenant, addIntegration, updateIntegration, removeIntegration, startImpersonation } = useTenants();
  const tenant = tenants.find(t => t.id === id);

  const [saved, setSaved] = useState(false);
  const [showAddInt, setShowAddInt] = useState(false);
  const [intForm, setIntForm] = useState(emptyIntForm);
  const [intErrors, setIntErrors] = useState<Record<string, string>>({});
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [access, setAccess] = useState<TenantAccess | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessBusy, setAccessBusy] = useState<string | null>(null);
  const [accessError, setAccessError] = useState('');
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [ownerLoginResult, setOwnerLoginResult] = useState<OwnerLoginResult | null>(null);

  const fetchAccess = async () => {
    if (!tenant) return;
    setAccessLoading(true);
    try {
      const data = await apiRequest<TenantAccess>(`/admin/tenants/${tenant.id}/access`);
      setAccess(data);
      setAccessError('');
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : 'Unable to load client access');
    } finally {
      setAccessLoading(false);
    }
  };

  useEffect(() => {
    void fetchAccess();
  }, [tenant?.id]);

  if (!tenant) {
    return (
      <div className="max-w-3xl mx-auto text-center py-24">
        <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
        <p className="text-muted-foreground">Client not found</p>
        <Button size="sm" className="mt-4" onClick={() => navigate('/mcc/tenants')}>Back to Clients</Button>
      </div>
    );
  }

  const plan = plans.find(p => p.key === tenant.plan) ?? plans[0];
  const statusCfg = statusConfig[tenant.status];
  const StatusIcon = statusCfg.icon;

  const totalIntCost = tenant.integrations.filter(i => i.isActive).reduce((s, i) => s + i.monthlyPrice, 0);
  const netProfit = tenant.mrr - totalIntCost;
  const margin = tenant.mrr > 0 ? Math.round((netProfit / tenant.mrr) * 100) : 0;
  const discountType = tenant.discountType ?? 'none';
  const discountValue = tenant.discountValue ?? 0;
  const discountAmount = discountType === 'percent'
    ? plan.price * Math.min(Math.max(discountValue, 0), 100) / 100
    : discountType === 'fixed'
      ? Math.max(discountValue, 0)
      : 0;
  const previewMrr = tenant.customPriceEnabled ? Number(tenant.customMrr ?? 0) : Math.max(0, plan.price - discountAmount);

  const toggleService = (key: ServiceKey) => {
    const updated = tenant.enabledServices.includes(key)
      ? tenant.enabledServices.filter(s => s !== key)
      : [...tenant.enabledServices, key];
    updateTenant(tenant.id, { enabledServices: updated });
  };

  const handlePlanChange = (planKey: PlanKey) => {
    const newPlan = plans.find(p => p.key === planKey)!;
    updateTenant(tenant.id, {
      plan: planKey,
      enabledServices: newPlan.services,
    });
  };

  const handleStatusChange = (status: TenantStatus) => {
    updateTenant(tenant.id, { status });
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = () => {
    if (window.confirm(`Delete ${tenant.companyName}? This cannot be undone.`)) {
      deleteTenant(tenant.id);
      navigate('/mcc/tenants');
    }
  };

  const runAccessAction = async <T,>(action: string, request: () => Promise<T>, onSuccess: (value: T) => void) => {
    setAccessBusy(action);
    setAccessError('');
    try {
      const result = await request();
      onSuccess(result);
      await fetchAccess();
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setAccessBusy(null);
    }
  };

  const copyText = (value: string) => {
    void navigator.clipboard.writeText(value);
  };

  const formatLoginDetails = (details: OwnerLoginResult) => [
    `Login URL: ${details.loginUrl}`,
    `Email: ${details.email}`,
    details.temporaryPassword ? `Temporary password: ${details.temporaryPassword}` : null,
    `Role: ${details.role}`,
    `Tenant: ${details.tenantName}`,
    `Services: ${details.enabledServices.join(', ') || 'None'}`,
  ].filter(Boolean).join('\n');

  const setIntField = (field: string, value: string) => {
    setIntForm(f => ({ ...f, [field]: value }));
    setIntErrors(e => { const n = { ...e }; delete n[field]; return n; });
  };

  const handleAddIntegration = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!intForm.platformKey) errs.platformKey = 'Select a platform';
    if (!intForm.apiKey.trim()) errs.apiKey = 'API key is required';
    if (!intForm.monthlyPrice || isNaN(Number(intForm.monthlyPrice))) errs.monthlyPrice = 'Enter a valid price';
    if (Object.keys(errs).length > 0) { setIntErrors(errs); return; }

    addIntegration(tenant.id, {
      platformKey: intForm.platformKey as IntegrationPlatformKey,
      customName: intForm.customName.trim() || undefined,
      apiKey: intForm.apiKey.trim(),
      monthlyPrice: parseFloat(intForm.monthlyPrice),
      isActive: true,
      notes: intForm.notes.trim() || undefined,
    });
    setShowAddInt(false);
    setIntForm(emptyIntForm);
    setIntErrors({});
  };

  const toggleKeyVisibility = (intId: string) => {
    setVisibleKeys(v => ({ ...v, [intId]: !v[intId] }));
  };

  const maskKey = (key: string) => {
    if (key.includes('●')) return key;
    if (key.length <= 8) return '●'.repeat(key.length);
    return key.slice(0, 4) + '●'.repeat(Math.min(key.length - 8, 20)) + key.slice(-4);
  };

  const categorizedPlatforms = INTEGRATION_PLATFORMS.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {} as Record<string, typeof INTEGRATION_PLATFORMS>);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/mcc/tenants" className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-foreground">{tenant.companyName}</h1>
            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${statusCfg.className}`}>
              <StatusIcon className="h-3 w-3" />{statusCfg.label}
            </span>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${plan.bgColor} ${plan.color}`}>
              {plan.label} · ${plan.price}/mo
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{tenant.contactName} · {tenant.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              startImpersonation(tenant.id);
              navigate('/');
            }}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Open Client Portal
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete
          </Button>
          <Button size="sm" onClick={handleSave} className={saved ? 'bg-emerald-600 hover:bg-emerald-700' : ''}>
            {saved ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Saved!</> : <><Save className="h-3.5 w-3.5 mr-1.5" />Save Changes</>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="space-y-4">
          {/* Client Info */}
          <Card className="p-0">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Client Information</CardTitle></CardHeader>
            <CardContent className="space-y-3 pt-0">
              {[
                { icon: Building2, label: 'Company', value: tenant.companyName },
                { icon: Mail, label: 'Email', value: tenant.email },
                { icon: Phone, label: 'Phone', value: tenant.phone || '—' },
                { icon: Globe, label: 'Industry', value: tenant.industry || '—' },
                { icon: Calendar, label: 'Client since', value: new Date(tenant.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) },
                { icon: Users, label: 'Seats', value: tenant.seats.toString() },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-muted shrink-0">
                    <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                    <p className="text-sm text-foreground truncate">{item.value}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Revenue & Expenses Summary */}
          <Card className="p-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Revenue vs Expenses</CardTitle>
              <CardDescription>Monthly breakdown for this client</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <div>
                  <p className="text-xs text-emerald-700">Plan Revenue (MRR)</p>
                  <p className="text-2xl font-semibold text-emerald-700">${tenant.mrr}</p>
                </div>
                <DollarSign className="h-7 w-7 text-emerald-400" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-100">
                <div>
                  <p className="text-xs text-red-700">Integration Costs</p>
                  <p className="text-2xl font-semibold text-red-700">${totalIntCost.toFixed(2)}</p>
                </div>
                <TrendingDown className="h-7 w-7 text-red-400" />
              </div>

              <div className={`flex items-center justify-between p-3 rounded-xl border ${netProfit >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-amber-50 border-amber-100'}`}>
                <div>
                  <p className={`text-xs ${netProfit >= 0 ? 'text-indigo-700' : 'text-amber-700'}`}>Net Profit</p>
                  <p className={`text-2xl font-semibold ${netProfit >= 0 ? 'text-indigo-700' : 'text-amber-700'}`}>
                    ${netProfit.toFixed(2)}
                  </p>
                </div>
                <div className={`text-sm font-bold px-2 py-1 rounded-lg ${netProfit >= 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                  {margin}% margin
                </div>
              </div>

              {tenant.trialEndsAt && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-50 border border-sky-100 text-xs text-sky-700">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  Trial ends {new Date(tenant.trialEndsAt).toLocaleDateString()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs defaultValue="services">
            <TabsList className="h-9 w-full">
              <TabsTrigger value="services" className="flex-1 text-xs">
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />Services & Plan
              </TabsTrigger>
              <TabsTrigger value="access" className="flex-1 text-xs">
                <KeyRound className="h-3.5 w-3.5 mr-1.5" />Client Access
              </TabsTrigger>
              <TabsTrigger value="integrations" className="flex-1 text-xs">
                <Plug className="h-3.5 w-3.5 mr-1.5" />
                Integrations
                {tenant.integrations.length > 0 && (
                  <span className="ml-1.5 bg-primary/10 text-primary text-[10px] px-1.5 rounded-full">{tenant.integrations.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="status" className="flex-1 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Account Status
              </TabsTrigger>
            </TabsList>

            {/* ── Services & Plan ── */}
            <TabsContent value="services" className="space-y-4 mt-4">
              <Card className="p-0">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Subscription Plan</CardTitle>
                  <CardDescription>Changing the plan updates billing and default services</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-2">
                    {plans.filter(p => p.isActive !== false).map(p => (
                      <button key={p.key} onClick={() => handlePlanChange(p.key)}
                        className={`p-3.5 rounded-xl border-2 text-left transition-all ${tenant.plan === p.key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.bgColor} ${p.color}`}>{p.label}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-base font-bold text-foreground">${p.price}</span>
                            <span className="text-xs text-muted-foreground">/mo</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {p.services.map(s => {
                            const svc = services.find(x => x.key === s);
                            return <span key={s} className="text-[10px] text-muted-foreground">{svc?.icon} {svc?.label}</span>;
                          })}
                        </div>
                        {tenant.plan === p.key && (
                          <div className="mt-2 flex items-center gap-1 text-primary text-[10px] font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Current plan
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="p-0">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Client Discount And Final MRR</CardTitle>
                  <CardDescription>Set a client-specific discount or a custom monthly price.</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Discount Type</Label>
                      <Select
                        value={discountType}
                        onValueChange={value => updateTenant(tenant.id, { discountType: value as Tenant['discountType'] })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No discount</SelectItem>
                          <SelectItem value="percent">Percentage</SelectItem>
                          <SelectItem value="fixed">Fixed amount</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Discount Value</Label>
                      <Input
                        type="number"
                        min="0"
                        value={discountValue}
                        disabled={discountType === 'none'}
                        onChange={event => updateTenant(tenant.id, { discountValue: Number(event.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Discount Expiry</Label>
                      <Input
                        type="date"
                        value={tenant.discountExpiresAt ?? ''}
                        onChange={event => updateTenant(tenant.id, { discountExpiresAt: event.target.value || undefined })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-3">
                    <div className="space-y-1.5">
                      <Label>Discount Reason</Label>
                      <Input
                        value={tenant.discountReason ?? ''}
                        placeholder="Launch offer, annual prepay, retention, partner deal..."
                        onChange={event => updateTenant(tenant.id, { discountReason: event.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Custom MRR</Label>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!tenant.customPriceEnabled}
                          onCheckedChange={value => updateTenant(tenant.id, { customPriceEnabled: value })}
                        />
                        <Input
                          type="number"
                          min="0"
                          disabled={!tenant.customPriceEnabled}
                          value={tenant.customMrr ?? ''}
                          onChange={event => updateTenant(tenant.id, { customMrr: Number(event.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Plan ${plan.price}/mo</span>
                    <span className="mx-2 text-muted-foreground">-</span>
                    <span className="text-muted-foreground">Discount ${discountAmount.toFixed(2)}</span>
                    <span className="mx-2 text-muted-foreground">=</span>
                    <span className="font-semibold text-foreground">Final MRR ${previewMrr.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="p-0">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <div>
                      <CardTitle className="text-sm">Service Access</CardTitle>
                      <CardDescription>Toggle individual services for this client</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {services.filter(svc => svc.isActive !== false).map((svc, i) => (
                    <div key={svc.key}>
                      {i > 0 && <Separator />}
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{svc.icon}</span>
                          <div>
                            <p className="text-sm font-medium text-foreground">{svc.label}</p>
                            <p className="text-xs text-muted-foreground">{svc.description}</p>
                          </div>
                        </div>
                        <Switch checked={tenant.enabledServices.includes(svc.key)} onCheckedChange={() => toggleService(svc.key)} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="access" className="space-y-4 mt-4">
              <Card className="p-0">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" />
                    <div>
                      <CardTitle className="text-sm">Client Access</CardTitle>
                      <CardDescription>Create login access or send an invite for this client</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  {accessError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{accessError}</div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Portal Login</p>
                      <p className="text-sm font-medium text-foreground truncate">{access?.loginUrl ?? 'Loading...'}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Client Email</p>
                      <p className="text-sm font-medium text-foreground truncate">{tenant.email}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Owner Login</p>
                      <p className="text-sm font-medium text-foreground">
                        {accessLoading ? 'Checking...' : access?.owner ? `${access.owner.user.name} · ${access.owner.user.email}` : 'Not created'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Pending Invites</p>
                      <p className="text-sm font-medium text-foreground">{access?.pendingInvites.length ?? 0}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      onClick={() => runAccessAction('invite', () => apiRequest<InviteResult>(`/admin/tenants/${tenant.id}/access/invite-owner`, { method: 'POST' }), setInviteResult)}
                      disabled={!!accessBusy}
                    >
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      {accessBusy === 'invite' ? 'Creating Invite...' : 'Send Client Invite'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runAccessAction('create', () => apiRequest<OwnerLoginResult>(`/admin/tenants/${tenant.id}/access/create-owner-login`, { method: 'POST' }), setOwnerLoginResult)}
                      disabled={!!accessBusy}
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                      {accessBusy === 'create' ? 'Creating...' : 'Create Owner Login'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runAccessAction('reset', () => apiRequest<OwnerLoginResult>(`/admin/tenants/${tenant.id}/access/reset-owner-password`, { method: 'POST' }), setOwnerLoginResult)}
                      disabled={!!accessBusy}
                    >
                      <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                      {accessBusy === 'reset' ? 'Resetting...' : 'Reset Client Password'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runAccessAction('copy', () => apiRequest<OwnerLoginResult>(`/admin/tenants/${tenant.id}/access/login-details`), details => copyText(formatLoginDetails(details)))}
                      disabled={!!accessBusy}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Copy Login Details
                    </Button>
                  </div>

                  {inviteResult && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                      <p className="font-medium">Invite created for {inviteResult.email}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <code className="flex-1 truncate rounded border bg-background px-2 py-1 text-[11px] text-foreground">{inviteResult.inviteUrl}</code>
                        <Button size="sm" variant="outline" onClick={() => copyText(inviteResult.inviteUrl)}>Copy</Button>
                      </div>
                      <p className="mt-1">Expires {new Date(inviteResult.expiresAt).toLocaleString()}</p>
                    </div>
                  )}

                  {ownerLoginResult?.temporaryPassword && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      <p className="font-medium">Temporary password generated. It will not be shown again.</p>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <code className="rounded border bg-background px-2 py-1 text-[11px] text-foreground">{ownerLoginResult.email}</code>
                        <code className="rounded border bg-background px-2 py-1 text-[11px] text-foreground">{ownerLoginResult.temporaryPassword}</code>
                      </div>
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => copyText(formatLoginDetails(ownerLoginResult))}>
                        <Copy className="h-3.5 w-3.5 mr-1.5" />Copy Email And Password
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Integrations ── */}
            <TabsContent value="integrations" className="space-y-4 mt-4">
              {/* Add Integration Modal */}
              {showAddInt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddInt(false)} />
                  <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-lg border border-border max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
                      <div>
                        <h2 className="text-base font-semibold text-foreground">Add Integration</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Connect a third-party platform for {tenant.companyName}</p>
                      </div>
                      <button onClick={() => setShowAddInt(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <form onSubmit={handleAddIntegration} className="px-6 py-5 space-y-4">
                      <div className="space-y-1.5">
                        <Label>Platform <span className="text-destructive">*</span></Label>
                        <Select value={intForm.platformKey} onValueChange={v => setIntField('platformKey', v)}>
                          <SelectTrigger className={intErrors.platformKey ? 'border-destructive' : ''}>
                            <SelectValue placeholder="Select platform" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(categorizedPlatforms).map(([cat, platforms]) => (
                              <div key={cat}>
                                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{cat}</div>
                                {platforms.map(p => (
                                  <SelectItem key={p.key} value={p.key}>
                                    <span className="flex items-center gap-2">
                                      <span>{p.icon}</span>
                                      <span>{p.name}</span>
                                    </span>
                                  </SelectItem>
                                ))}
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                        {intErrors.platformKey && <p className="text-xs text-destructive">{intErrors.platformKey}</p>}
                      </div>

                      {intForm.platformKey === 'custom' && (
                        <div className="space-y-1.5">
                          <Label>Custom Name</Label>
                          <Input placeholder="e.g. Internal Lead API" value={intForm.customName} onChange={e => setIntField('customName', e.target.value)} />
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label>API Key <span className="text-destructive">*</span></Label>
                        <Input
                          placeholder="Paste API key here"
                          value={intForm.apiKey}
                          onChange={e => setIntField('apiKey', e.target.value)}
                          className={`font-mono text-sm ${intErrors.apiKey ? 'border-destructive' : ''}`}
                        />
                        {intErrors.apiKey && <p className="text-xs text-destructive">{intErrors.apiKey}</p>}
                        <p className="text-xs text-muted-foreground">🔒 Stored securely. Use masked key format for production.</p>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Monthly Cost (USD) <span className="text-destructive">*</span></Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                          <Input
                            type="number" min="0" step="0.01" placeholder="0.00"
                            value={intForm.monthlyPrice}
                            onChange={e => setIntField('monthlyPrice', e.target.value)}
                            className={`pl-7 ${intErrors.monthlyPrice ? 'border-destructive' : ''}`}
                          />
                        </div>
                        {intErrors.monthlyPrice && <p className="text-xs text-destructive">{intErrors.monthlyPrice}</p>}
                        <p className="text-xs text-muted-foreground">Enter what you're paying for this platform per month for this client</p>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Notes</Label>
                        <textarea
                          value={intForm.notes}
                          onChange={e => setIntField('notes', e.target.value)}
                          placeholder="Account tier, usage limits, expiry date..."
                          className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[60px]"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                        <Button type="button" variant="outline" size="sm" onClick={() => setShowAddInt(false)}>Cancel</Button>
                        <Button type="submit" size="sm">
                          <Plus className="h-3.5 w-3.5 mr-1.5" />Add Integration
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Integration summary bar */}
              {tenant.integrations.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-muted/40 border border-border text-center">
                    <p className="text-xs text-muted-foreground">Total Integrations</p>
                    <p className="text-lg font-semibold text-foreground">{tenant.integrations.length}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-center">
                    <p className="text-xs text-red-700">Monthly Cost</p>
                    <p className="text-lg font-semibold text-red-700">${totalIntCost.toFixed(2)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                    <p className="text-xs text-emerald-700">Active</p>
                    <p className="text-lg font-semibold text-emerald-700">{tenant.integrations.filter(i => i.isActive).length}</p>
                  </div>
                </div>
              )}

              {/* Integration cards */}
              <div className="space-y-3">
                {tenant.integrations.map(integration => {
                  const platform = INTEGRATION_PLATFORMS.find(p => p.key === integration.platformKey);
                  const displayName = integration.customName || platform?.name || integration.platformKey;
                  const isVisible = visibleKeys[integration.id];
                  return (
                    <Card key={integration.id} className={`p-0 ${!integration.isActive ? 'opacity-60' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${platform?.bgColor || 'bg-muted'}`}>
                            {platform?.icon || '🔌'}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div>
                                <span className="text-sm font-semibold text-foreground">{displayName}</span>
                                {platform && (
                                  <span className="ml-2 text-xs text-muted-foreground">{platform.category}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold ${integration.isActive ? 'text-red-600' : 'text-muted-foreground'}`}>
                                  ${integration.monthlyPrice.toFixed(2)}/mo
                                </span>
                                <Switch
                                  checked={integration.isActive}
                                  onCheckedChange={v => updateIntegration(tenant.id, integration.id, { isActive: v })}
                                />
                                <button
                                  onClick={() => removeIntegration(tenant.id, integration.id)}
                                  className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* API Key */}
                            <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 border border-border">
                              <code className="flex-1 text-xs font-mono text-muted-foreground truncate">
                                {isVisible ? integration.apiKey : maskKey(integration.apiKey)}
                              </code>
                              <button onClick={() => toggleKeyVisibility(integration.id)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                                {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                onClick={() => navigator.clipboard.writeText(integration.apiKey)}
                                className="text-xs text-primary hover:underline shrink-0"
                              >
                                Copy
                              </button>
                            </div>

                            {/* Notes + edit price */}
                            <div className="flex items-center gap-3 flex-wrap">
                              {integration.notes && (
                                <p className="text-xs text-muted-foreground">{integration.notes}</p>
                              )}
                              <div className="flex items-center gap-2 ml-auto">
                                <span className="text-xs text-muted-foreground">Price:</span>
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                                  <input
                                    type="number" min="0" step="0.01"
                                    value={integration.monthlyPrice}
                                    onChange={e => updateIntegration(tenant.id, integration.id, { monthlyPrice: parseFloat(e.target.value) || 0 })}
                                    className="w-24 pl-5 pr-2 py-1 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/30"
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">Added {integration.addedAt}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => setShowAddInt(true)}>
                <Plus className="h-4 w-4" />
                Add Integration
              </Button>

              {tenant.integrations.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                  <Plug className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No integrations yet</p>
                  <p className="text-xs mt-1">Add API keys for platforms like Apollo, SendGrid, Twilio, etc.</p>
                </div>
              )}
            </TabsContent>

            {/* ── Account Status ── */}
            <TabsContent value="status" className="space-y-4 mt-4">
              <Card className="p-0">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Account Status</CardTitle>
                  <CardDescription>Change the client's account status</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-2">
                    {(['active', 'trial', 'suspended', 'cancelled'] as TenantStatus[]).map(s => {
                      const cfg = statusConfig[s];
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(s)}
                          className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${tenant.status === s ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/30 text-muted-foreground'}`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className={`mt-4 px-4 py-3 rounded-xl border text-xs flex items-start gap-2 ${
                    tenant.status === 'active' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                    tenant.status === 'trial' ? 'bg-sky-50 border-sky-100 text-sky-700' :
                    'bg-amber-50 border-amber-100 text-amber-700'
                  }`}>
                    <StatusIcon className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      {tenant.status === 'active' && 'Account is active — client has full access to all enabled services.'}
                      {tenant.status === 'trial' && `Account is in trial — full access until ${tenant.trialEndsAt || 'trial ends'}. Activating will start billing at $${plan.price}/mo.`}
                      {tenant.status === 'suspended' && 'Account suspended — client cannot log in or access any services.'}
                      {tenant.status === 'cancelled' && 'Account cancelled — all access has been revoked.'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {tenant.notes && (
                <Card className="p-0">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Internal Notes</CardTitle></CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">{tenant.notes}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
