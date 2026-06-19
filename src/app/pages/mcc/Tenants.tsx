import { useState } from 'react';
import { Link } from 'react-router';
import { useTenants, PLANS, ALL_SERVICES, type PlanKey, type ServiceKey, type TenantStatus } from '../../contexts/TenantContext';
import {
  Plus, Search, Building2, Users, DollarSign, TrendingUp, MoreHorizontal,
  X, CheckCircle2, Clock, AlertCircle, XCircle, Zap, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Separator } from '../../components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { Switch } from '../../components/ui/switch';

const statusConfig: Record<TenantStatus, { label: string; icon: React.ElementType; className: string }> = {
  active: { label: 'Active', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  trial: { label: 'Trial', icon: Clock, className: 'bg-sky-50 text-sky-700 border-sky-200' },
  suspended: { label: 'Suspended', icon: AlertCircle, className: 'bg-amber-50 text-amber-700 border-amber-200' },
  cancelled: { label: 'Cancelled', icon: XCircle, className: 'bg-red-50 text-red-700 border-red-200' },
};

const INDUSTRIES = ['Technology', 'SaaS', 'Finance', 'Healthcare', 'Retail', 'Manufacturing', 'Consulting', 'Education', 'Other'];

const emptyForm = {
  companyName: '', contactName: '', email: '', phone: '', industry: '',
  plan: 'starter' as PlanKey, seats: '5', notes: '',
};

export function Tenants() {
  const { tenants, addTenant, updateTenant, deleteTenant } = useTenants();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filtered = tenants.filter(t => {
    const matchSearch = t.companyName.toLowerCase().includes(search.toLowerCase()) ||
      t.contactName.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalMRR = tenants.filter(t => t.status === 'active').reduce((s, t) => s + t.mrr, 0);
  const activeCount = tenants.filter(t => t.status === 'active').length;
  const trialCount = tenants.filter(t => t.status === 'trial').length;

  const set = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.companyName.trim()) e.companyName = 'Company name is required';
    if (!form.contactName.trim()) e.contactName = 'Contact name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email address';
    return e;
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    const plan = PLANS.find(p => p.key === form.plan)!;
    addTenant({
      companyName: form.companyName.trim(),
      contactName: form.contactName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      industry: form.industry || undefined,
      plan: form.plan,
      status: 'trial',
      enabledServices: plan.services,
      seats: parseInt(form.seats) || 5,
      mrr: 0,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: form.notes.trim() || undefined,
    });
    setShowCreate(false);
    setForm(emptyForm);
    setErrors({});
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Create Tenant Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-lg border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
              <div>
                <h2 className="text-base font-semibold text-foreground">New Client Account</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Create a new tenant and assign services</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Company Name <span className="text-destructive">*</span></Label>
                  <Input placeholder="Company name" value={form.companyName} onChange={e => set('companyName', e.target.value)} className={errors.companyName ? 'border-destructive' : ''} />
                  {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Name <span className="text-destructive">*</span></Label>
                  <Input placeholder="Primary contact" value={form.contactName} onChange={e => set('contactName', e.target.value)} className={errors.contactName ? 'border-destructive' : ''} />
                  {errors.contactName && <p className="text-xs text-destructive">{errors.contactName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Email <span className="text-destructive">*</span></Label>
                  <Input type="email" placeholder="contact@company.com" value={form.email} onChange={e => set('email', e.target.value)} className={errors.email ? 'border-destructive' : ''} />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input placeholder="Business phone" value={form.phone} onChange={e => set('phone', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Industry</Label>
                  <Select value={form.industry} onValueChange={v => set('industry', v)}>
                    <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                    <SelectContent>{INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Subscription Plan</Label>
                <div className="grid grid-cols-2 gap-2">
                  {PLANS.map(plan => (
                    <button
                      key={plan.key}
                      type="button"
                      onClick={() => set('plan', plan.key)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${form.plan === plan.key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${plan.bgColor} ${plan.color}`}>{plan.label}</span>
                        <span className="text-sm font-bold text-foreground">${plan.price}<span className="text-xs text-muted-foreground font-normal">/mo</span></span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {plan.services.map(s => {
                          const svc = ALL_SERVICES.find(x => x.key === s);
                          return <span key={s} className="text-[10px] text-muted-foreground">{svc?.icon} {svc?.label}</span>;
                        })}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Number of Seats</Label>
                <Input type="number" min="1" max="999" value={form.seats} onChange={e => set('seats', e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <textarea
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="Internal notes about this client..."
                  className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[72px]"
                />
              </div>

              <p className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-2">
                ✅ Account will start with a <strong>14-day free trial</strong>. Services from the selected plan will be enabled automatically.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button type="submit" size="sm">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Create Account
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <h1 className="text-foreground">Client Management Center</h1>
          </div>
          <p className="text-sm text-muted-foreground">Manage all your client accounts, subscriptions, and service access</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Client
        </Button>
      </div>

      {/* MRR Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Monthly Revenue', value: `$${totalMRR.toLocaleString()}`, sub: 'MRR', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Active Clients', value: activeCount.toString(), sub: `${tenants.length} total`, icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'On Trial', value: trialCount.toString(), sub: 'Converting soon', icon: Clock, color: 'text-sky-600', bg: 'bg-sky-50' },
          { label: 'Avg MRR / Client', value: activeCount > 0 ? `$${Math.round(totalMRR / activeCount)}` : '$0', sub: 'Per active account', icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(m => (
          <Card key={m.label} className="p-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${m.bg} shrink-0`}>
                <m.icon className={`h-4 w-4 ${m.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-xl font-semibold text-foreground">{m.value}</p>
                <p className="text-[10px] text-muted-foreground/70">{m.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 bg-muted/50" />
        </div>
        <div className="flex items-center gap-2">
          {['all', 'active', 'trial', 'suspended', 'cancelled'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              {s === 'all' ? `All (${tenants.length})` : s}
            </button>
          ))}
        </div>
      </div>

      {/* Tenants Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Client</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Plan</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Services</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">MRR</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground hidden xl:table-cell">Seats</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Since</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(tenant => {
                const plan = PLANS.find(p => p.key === tenant.plan)!;
                const statusCfg = statusConfig[tenant.status];
                const StatusIcon = statusCfg.icon;
                return (
                  <tr key={tenant.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                          {tenant.companyName[0]}
                        </div>
                        <div>
                          <Link to={`/mcc/tenants/${tenant.id}`} className="text-sm font-medium text-foreground hover:text-primary hover:underline transition-colors">
                            {tenant.companyName}
                          </Link>
                          <div className="text-xs text-muted-foreground">{tenant.contactName} · {tenant.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${plan.bgColor} ${plan.color}`}>{plan.label}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${statusCfg.className}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <div className="flex items-center gap-1 flex-wrap">
                        {tenant.enabledServices.length > 0 ? (
                          tenant.enabledServices.slice(0, 3).map(sk => {
                            const svc = ALL_SERVICES.find(s => s.key === sk);
                            return <span key={sk} title={svc?.label} className="text-base">{svc?.icon}</span>;
                          })
                        ) : (
                          <span className="text-xs text-muted-foreground/50">No services</span>
                        )}
                        {tenant.enabledServices.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{tenant.enabledServices.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className="text-sm font-medium text-emerald-600">
                        {tenant.mrr > 0 ? `$${tenant.mrr}` : <span className="text-muted-foreground/50">—</span>}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden xl:table-cell text-sm text-muted-foreground">
                      {tenant.seats}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-xs text-muted-foreground">
                      {new Date(tenant.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/mcc/tenants/${tenant.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors whitespace-nowrap"
                        >
                          Manage <ChevronRight className="h-3 w-3" />
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild><Link to={`/mcc/tenants/${tenant.id}`}>Manage</Link></DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateTenant(tenant.id, { status: 'active', mrr: PLANS.find(p => p.key === tenant.plan)!.price })}>
                              Activate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateTenant(tenant.id, { status: 'suspended', mrr: 0 })}>
                              Suspend
                            </DropdownMenuItem>
                            <Separator className="my-1" />
                            <DropdownMenuItem className="text-destructive" onClick={() => deleteTenant(tenant.id)}>
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No clients found</p>
              <Button size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-1.5" />Add First Client
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
