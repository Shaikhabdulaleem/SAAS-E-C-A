import { useState, useEffect } from 'react';
import { Plus, Mail, MoreHorizontal, X, Flame, Pause, Play, Trash2, Edit3, Power, Clock, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Separator } from '../../components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { apiRequest } from '../../lib/api';

interface Mailbox {
  id: string;
  email: string;
  fromName: string;
  provider: 'gmail' | 'outlook' | 'custom_smtp';
  status: 'active' | 'paused' | 'error' | 'disconnected';
  warmupStatus: 'not_started' | 'warming' | 'ready' | 'paused';
  dailySendLimit: number;
  sentToday: number;
  sendWindowStart: string;
  sendWindowEnd: string;
  replyToEmail?: string;
  sendWeekdaysOnly: boolean;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  warmupEnabled: boolean;
  signature?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700' },
  paused: { label: 'Paused', className: 'bg-amber-50 text-amber-700' },
  error: { label: 'Error', className: 'bg-red-50 text-red-700' },
  disconnected: { label: 'Disconnected', className: 'bg-muted text-muted-foreground' },
};

const warmupConfig: Record<string, { label: string; className: string }> = {
  not_started: { label: 'Not Started', className: 'bg-muted text-muted-foreground' },
  warming: { label: 'Warming Up', className: 'bg-orange-50 text-orange-700' },
  ready: { label: 'Ready', className: 'bg-emerald-50 text-emerald-700' },
  paused: { label: 'Warmup Paused', className: 'bg-amber-50 text-amber-700' },
};

const providerIcons: Record<string, string> = {
  gmail: 'G',
  outlook: 'O',
  custom_smtp: 'S',
};

const providerColors: Record<string, { bg: string; text: string }> = {
  gmail: { bg: 'bg-red-50', text: 'text-red-600' },
  outlook: { bg: 'bg-blue-50', text: 'text-blue-600' },
  custom_smtp: { bg: 'bg-slate-100', text: 'text-slate-600' },
};

const defaultForm = {
  provider: 'gmail' as 'gmail' | 'outlook' | 'custom_smtp',
  email: '',
  fromName: '',
  replyToEmail: '',
  dailySendLimit: 40,
  sendWindowStart: '08:00',
  sendWindowEnd: '17:00',
  sendWeekdaysOnly: true,
  minDelaySeconds: 180,
  maxDelaySeconds: 480,
  warmupEnabled: true,
  signature: '',
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
};

export function ColdMailboxes() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const result = await apiRequest<Mailbox[]>('/cold-email/mailboxes');
      setMailboxes(result);
    } catch {} finally {
      setLoading(false);
    }
  };

  const totalMailboxes = mailboxes.length;
  const activeCount = mailboxes.filter(m => m.status === 'active').length;
  const warmingCount = mailboxes.filter(m => m.warmupStatus === 'warming').length;
  const readyCount = mailboxes.filter(m => m.warmupStatus === 'ready').length;

  const set = (field: string, value: string | number | boolean) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.email.trim()) e.email = 'Email address is required';
    if (!form.fromName.trim()) e.fromName = 'From name is required';
    if (form.provider === 'custom_smtp') {
      if (!form.smtpHost.trim()) e.smtpHost = 'SMTP host is required';
      if (!form.smtpUser.trim()) e.smtpUser = 'SMTP username is required';
    }
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    try {
      if (editingId) {
        const updated = await apiRequest<Mailbox>(`/cold-email/mailboxes/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(form),
        });
        setMailboxes(prev => prev.map(m => m.id === editingId ? updated : m));
      } else {
        const newMailbox = await apiRequest<Mailbox>('/cold-email/mailboxes', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        setMailboxes(prev => [...prev, newMailbox]);
      }
      setShowModal(false);
      setEditingId(null);
      setForm({ ...defaultForm });
      setErrors({});
    } catch {}
  };

  const handleEdit = (mailbox: Mailbox) => {
    setEditingId(mailbox.id);
    setForm({
      email: mailbox.email,
      fromName: mailbox.fromName,
      provider: mailbox.provider,
      replyToEmail: mailbox.replyToEmail ?? '',
      dailySendLimit: mailbox.dailySendLimit,
      sendWindowStart: mailbox.sendWindowStart ?? '08:00',
      sendWindowEnd: mailbox.sendWindowEnd ?? '17:00',
      sendWeekdaysOnly: mailbox.sendWeekdaysOnly ?? false,
      minDelaySeconds: mailbox.minDelaySeconds ?? 60,
      maxDelaySeconds: mailbox.maxDelaySeconds ?? 180,
      warmupEnabled: mailbox.warmupEnabled ?? false,
      signature: mailbox.signature ?? '',
      smtpHost: mailbox.smtpHost ?? '',
      smtpPort: mailbox.smtpPort ?? 587,
      smtpUser: mailbox.smtpUser ?? '',
    });
    setShowModal(true);
  };

  const handleTestSmtp = async () => {
    if (!form.smtpHost.trim()) return;
    setTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const result = await apiRequest<{ success: boolean; banner?: string; error?: string }>('/cold-email/mailboxes/test-smtp', {
        method: 'POST',
        body: JSON.stringify({ host: form.smtpHost, port: form.smtpPort }),
      });
      setSmtpTestResult(result.success ? `Connected: ${result.banner ?? 'OK'}` : `Failed: ${result.error}`);
    } catch (err) {
      setSmtpTestResult(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleToggleWarmup = async (id: string) => {
    try {
      const updated = await apiRequest<Mailbox>(`/cold-email/mailboxes/${id}/toggle-warmup`, { method: 'POST' });
      setMailboxes(prev => prev.map(m => m.id === id ? updated : m));
    } catch {}
  };

  const handlePause = async (id: string) => {
    try {
      const updated = await apiRequest<Mailbox>(`/cold-email/mailboxes/${id}/pause`, { method: 'POST' });
      setMailboxes(prev => prev.map(m => m.id === id ? updated : m));
    } catch {}
  };

  const handleActivate = async (id: string) => {
    try {
      const updated = await apiRequest<Mailbox>(`/cold-email/mailboxes/${id}/activate`, { method: 'POST' });
      setMailboxes(prev => prev.map(m => m.id === id ? updated : m));
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this mailbox?')) return;
    try {
      await apiRequest(`/cold-email/mailboxes/${id}`, { method: 'DELETE' });
      setMailboxes(prev => prev.filter(m => m.id !== id));
    } catch {}
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-16 text-center">
        <p className="text-sm text-muted-foreground">Loading mailboxes...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-lg border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background rounded-t-2xl z-10">
              <div>
                <h2 className="text-base font-semibold text-foreground">Connect Mailbox</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Add a new sending account for cold outreach</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Provider</Label>
                <Select value={form.provider} onValueChange={v => set('provider', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gmail">Gmail</SelectItem>
                    <SelectItem value="outlook">Outlook</SelectItem>
                    <SelectItem value="custom_smtp">Custom SMTP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mb-email" className="text-sm">Email Address</Label>
                  <Input id="mb-email" placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} className={errors.email ? 'border-destructive' : ''} />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mb-from" className="text-sm">From Name</Label>
                  <Input id="mb-from" placeholder="Sender name" value={form.fromName} onChange={e => set('fromName', e.target.value)} className={errors.fromName ? 'border-destructive' : ''} />
                  {errors.fromName && <p className="text-xs text-destructive">{errors.fromName}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mb-reply" className="text-sm">Reply-To Email</Label>
                <Input id="mb-reply" placeholder="reply@example.com (optional)" value={form.replyToEmail} onChange={e => set('replyToEmail', e.target.value)} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mb-limit" className="text-sm">Daily Limit</Label>
                  <Input id="mb-limit" type="number" min={1} max={50} value={form.dailySendLimit} onChange={e => set('dailySendLimit', parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mb-start" className="text-sm">Window Start</Label>
                  <Input id="mb-start" type="time" value={form.sendWindowStart} onChange={e => set('sendWindowStart', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mb-end" className="text-sm">Window End</Label>
                  <Input id="mb-end" type="time" value={form.sendWindowEnd} onChange={e => set('sendWindowEnd', e.target.value)} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">Weekdays Only</Label>
                <Switch checked={form.sendWeekdaysOnly} onCheckedChange={v => set('sendWeekdaysOnly', v)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mb-min-delay" className="text-sm">Min Delay (seconds)</Label>
                  <Input id="mb-min-delay" type="number" min={10} value={form.minDelaySeconds} onChange={e => set('minDelaySeconds', parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mb-max-delay" className="text-sm">Max Delay (seconds)</Label>
                  <Input id="mb-max-delay" type="number" min={10} value={form.maxDelaySeconds} onChange={e => set('maxDelaySeconds', parseInt(e.target.value) || 0)} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">Enable Warmup</Label>
                <Switch checked={form.warmupEnabled} onCheckedChange={v => set('warmupEnabled', v)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mb-sig" className="text-sm">Signature</Label>
                <textarea id="mb-sig" rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" placeholder="Your email signature..." value={form.signature} onChange={e => set('signature', e.target.value)} />
              </div>

              {form.provider === 'custom_smtp' && (
                <>
                  <Separator />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">SMTP Settings</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="mb-smtp-host" className="text-sm">Host</Label>
                      <Input id="mb-smtp-host" placeholder="smtp.example.com" value={form.smtpHost} onChange={e => set('smtpHost', e.target.value)} className={errors.smtpHost ? 'border-destructive' : ''} />
                      {errors.smtpHost && <p className="text-xs text-destructive">{errors.smtpHost}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mb-smtp-port" className="text-sm">Port</Label>
                      <Input id="mb-smtp-port" type="number" value={form.smtpPort} onChange={e => set('smtpPort', parseInt(e.target.value) || 587)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mb-smtp-user" className="text-sm">Username</Label>
                    <Input id="mb-smtp-user" placeholder="username" value={form.smtpUser} onChange={e => set('smtpUser', e.target.value)} className={errors.smtpUser ? 'border-destructive' : ''} />
                    {errors.smtpUser && <p className="text-xs text-destructive">{errors.smtpUser}</p>}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => void handleTestSmtp()} disabled={testingSmtp || !form.smtpHost.trim()}>
                    {testingSmtp ? 'Testing...' : 'Test Connection'}
                  </Button>
                  {smtpTestResult && <p className={`text-xs ${smtpTestResult.startsWith('Connected') ? 'text-emerald-600' : 'text-destructive'}`}>{smtpTestResult}</p>}
                </>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border mt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => { setShowModal(false); setEditingId(null); }}>Cancel</Button>
                <Button type="submit" size="sm">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  {editingId ? 'Save Changes' : 'Connect Mailbox'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-foreground">Connected Mailboxes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your sending accounts for cold outreach</p>
        </div>
        <Button size="sm" onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Connect Mailbox
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Mailboxes', value: totalMailboxes.toString(), icon: Mail, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Active', value: activeCount.toString(), icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Warming Up', value: warmingCount.toString(), icon: Flame, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Ready to Send', value: readyCount.toString(), icon: Send, color: 'text-sky-600', bg: 'bg-sky-50' },
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

      <div className="space-y-3">
        {mailboxes.map(mailbox => {
          const sCfg = statusConfig[mailbox.status];
          const wCfg = warmupConfig[mailbox.warmupStatus];
          const pColor = providerColors[mailbox.provider];
          return (
            <Card key={mailbox.id} className="group hover:shadow-sm transition-all p-0">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`p-2.5 rounded-xl ${pColor.bg} shrink-0`}>
                      <span className={`text-sm font-bold ${pColor.text}`}>{providerIcons[mailbox.provider]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-foreground">{mailbox.email}</h3>
                        <Badge variant="secondary" className={`text-xs h-5 ${sCfg.className}`}>{sCfg.label}</Badge>
                        <Badge variant="secondary" className={`text-xs h-5 ${wCfg.className} gap-1`}>
                          {mailbox.warmupStatus === 'warming' && <span>🔥</span>}
                          {wCfg.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">From: {mailbox.fromName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Daily Limit</p>
                      <p className="text-sm font-semibold text-foreground">{mailbox.sentToday}/{mailbox.dailySendLimit} sent today</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Send Window</p>
                      <p className="text-sm font-semibold text-foreground flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {mailbox.sendWindowStart} - {mailbox.sendWindowEnd}
                      </p>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(mailbox)}>
                        <Edit3 className="h-3.5 w-3.5 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleWarmup(mailbox.id)}>
                        <Flame className="h-3.5 w-3.5 mr-2" />
                        Toggle Warmup
                      </DropdownMenuItem>
                      {mailbox.status === 'active' ? (
                        <DropdownMenuItem onClick={() => handlePause(mailbox.id)}>
                          <Pause className="h-3.5 w-3.5 mr-2" />
                          Pause
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => handleActivate(mailbox.id)}>
                          <Play className="h-3.5 w-3.5 mr-2" />
                          Activate
                        </DropdownMenuItem>
                      )}
                      <Separator className="my-1" />
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(mailbox.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {mailboxes.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No mailboxes connected</p>
            <Button size="sm" className="mt-4" onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Connect Mailbox
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
