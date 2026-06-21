import { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { Link } from 'react-router';
import { Plus, Mail, Eye, MousePointerClick, Send, Clock, CheckCircle, BarChart2, MoreHorizontal, X, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Separator } from '../../components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';

const statusConfig: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground', icon: Clock },
  scheduled: { label: 'Scheduled', className: 'bg-sky-50 text-sky-700', icon: Clock },
  sending: { label: 'Sending', className: 'bg-amber-50 text-amber-700', icon: Send },
  sent: { label: 'Sent', className: 'bg-emerald-50 text-emerald-700', icon: CheckCircle },
  cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-700', icon: Mail },
};

export function Campaigns() {
  const { campaigns, addCampaign, deleteCampaign, sendCampaignNow, apiError } = useData();
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    subject: '',
    previewText: '',
    fromName: '',
    fromEmail: '',
    replyToEmail: '',
    status: 'draft' as 'draft' | 'scheduled',
    scheduledAt: '',
    trackOpens: true,
    trackClicks: true,
    gdprConsent: false,
    doubleOptIn: false,
    companyAddress: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredCampaigns = campaigns.filter(c => filter === 'all' || c.status === filter);

  const totalSent = campaigns.filter(c => c.status === 'sent').reduce((sum, c) => sum + c.totalRecipients, 0);
  const totalOpens = campaigns.filter(c => c.status === 'sent').reduce((sum, c) => sum + c.openCount, 0);
  const totalClicks = campaigns.filter(c => c.status === 'sent').reduce((sum, c) => sum + c.clickCount, 0);
  const openRate = totalSent > 0 ? (totalOpens / totalSent) * 100 : 0;
  const clickRate = totalSent > 0 ? (totalClicks / totalSent) * 100 : 0;

  const chartData = campaigns
    .filter(c => c.status === 'sent')
    .map(c => ({
      name: c.name.length > 16 ? c.name.slice(0, 14) + '…' : c.name,
      openRate: c.totalRecipients > 0 ? +((c.openCount / c.totalRecipients) * 100).toFixed(1) : 0,
      clickRate: c.totalRecipients > 0 ? +((c.clickCount / c.totalRecipients) * 100).toFixed(1) : 0,
    }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Campaign name is required';
    if (!form.subject.trim()) e.subject = 'Subject line is required';
    if (!form.fromName.trim()) e.fromName = 'Sender name is required';
    if (!form.fromEmail.trim()) e.fromEmail = 'Sender email is required';
    if (form.status === 'scheduled' && !form.scheduledAt) e.scheduledAt = 'Schedule date is required';
    return e;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    addCampaign({
      name: form.name.trim(),
      subject: form.subject.trim(),
      previewText: form.previewText.trim() || undefined,
      fromName: form.fromName.trim(),
      fromEmail: form.fromEmail.trim(),
      replyToEmail: form.replyToEmail.trim() || undefined,
      status: form.status,
      scheduledAt: form.status === 'scheduled' ? form.scheduledAt : undefined,
      totalRecipients: 0,
      openCount: 0,
      clickCount: 0,
      bounceCount: 0,
      unsubCount: 0,
      trackOpens: form.trackOpens,
      trackClicks: form.trackClicks,
      gdprConsent: form.gdprConsent,
      doubleOptIn: form.doubleOptIn,
      companyAddress: form.companyAddress.trim() || undefined,
    });
    setShowModal(false);
    setForm({ name: '', subject: '', previewText: '', fromName: '', fromEmail: '', replyToEmail: '', status: 'draft', scheduledAt: '', trackOpens: true, trackClicks: true, gdprConsent: false, doubleOptIn: false, companyAddress: '' });
    setErrors({});
  };

  const set = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {apiError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {apiError}
        </div>
      )}

      {/* New Campaign Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-lg border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground">New Campaign</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Set up your email campaign details</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="camp-name" className="text-sm">Campaign Name</Label>
                <Input
                  id="camp-name"
                  placeholder="e.g. Q3 Product Launch"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="camp-subject" className="text-sm">Subject Line</Label>
                  <Input
                    id="camp-subject"
                    placeholder="e.g. Introducing Our New Features"
                    value={form.subject}
                    onChange={e => set('subject', e.target.value)}
                    className={errors.subject ? 'border-destructive' : ''}
                  />
                  {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="camp-preview" className="text-sm">Preview Text</Label>
                  <Input
                    id="camp-preview"
                    placeholder="Brief text shown in inbox preview"
                    value={form.previewText}
                    onChange={e => set('previewText', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="camp-from-name" className="text-sm">Sender Name</Label>
                  <Input
                    id="camp-from-name"
                    placeholder="Sender name"
                    value={form.fromName}
                    onChange={e => set('fromName', e.target.value)}
                    className={errors.fromName ? 'border-destructive' : ''}
                  />
                  {errors.fromName && <p className="text-xs text-destructive">{errors.fromName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="camp-from-email" className="text-sm">Sender Email</Label>
                  <Input
                    id="camp-from-email"
                    type="email"
                    placeholder="sender@yourdomain.com"
                    value={form.fromEmail}
                    onChange={e => set('fromEmail', e.target.value)}
                    className={errors.fromEmail ? 'border-destructive' : ''}
                  />
                  {errors.fromEmail && <p className="text-xs text-destructive">{errors.fromEmail}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="camp-reply" className="text-sm">Reply-To Email</Label>
                <Input
                  id="camp-reply"
                  type="email"
                  placeholder="replies@yourdomain.com (optional)"
                  value={form.replyToEmail}
                  onChange={e => set('replyToEmail', e.target.value)}
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tracking & Compliance</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <Label className="text-sm">Track Opens</Label>
                    <Switch checked={form.trackOpens} onCheckedChange={v => setForm(f => ({ ...f, trackOpens: v }))} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <Label className="text-sm">Track Clicks</Label>
                    <Switch checked={form.trackClicks} onCheckedChange={v => setForm(f => ({ ...f, trackClicks: v }))} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <Label className="text-sm">GDPR Consent</Label>
                    <Switch checked={form.gdprConsent} onCheckedChange={v => setForm(f => ({ ...f, gdprConsent: v }))} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <Label className="text-sm">Double Opt-In</Label>
                    <Switch checked={form.doubleOptIn} onCheckedChange={v => setForm(f => ({ ...f, doubleOptIn: v }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="camp-address" className="text-sm">Company Address (required by law)</Label>
                  <Input
                    id="camp-address"
                    placeholder="123 Business St, City, State"
                    value={form.companyAddress}
                    onChange={e => set('companyAddress', e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label className="text-sm">Status</Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Save as Draft</SelectItem>
                    <SelectItem value="scheduled">Schedule for Later</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.status === 'scheduled' && (
                <div className="space-y-1.5">
                  <Label htmlFor="camp-scheduled" className="text-sm">Scheduled Date</Label>
                  <Input
                    id="camp-scheduled"
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={e => set('scheduledAt', e.target.value)}
                    className={errors.scheduledAt ? 'border-destructive' : ''}
                  />
                  {errors.scheduledAt && <p className="text-xs text-destructive">{errors.scheduledAt}</p>}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border mt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  {form.status === 'scheduled' ? 'Schedule Campaign' : 'Save as Draft'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-foreground">Email Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create and manage your email marketing campaigns</p>
        </div>
        <Button size="sm" onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Campaign
        </Button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Emails Sent', value: totalSent.toLocaleString(), icon: Send, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Open Rate', value: `${openRate.toFixed(1)}%`, icon: Eye, color: 'text-sky-600', bg: 'bg-sky-50', sub: `${totalOpens.toLocaleString()} opens` },
          { label: 'Click Rate', value: `${clickRate.toFixed(1)}%`, icon: MousePointerClick, color: 'text-violet-600', bg: 'bg-violet-50', sub: `${totalClicks.toLocaleString()} clicks` },
          { label: 'Total Campaigns', value: campaigns.length.toString(), icon: BarChart2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
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
                  {'sub' in stat && stat.sub && <p className="text-[10px] text-muted-foreground/70">{stat.sub}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Campaign Performance</CardTitle>
                <CardDescription>Open and click rates by campaign</CardDescription>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />Open Rate</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />Click Rate</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {([
                { key: 'openRate' as const, label: 'Open Rate', color: '#4F46E5' },
                { key: 'clickRate' as const, label: 'Click Rate', color: '#7C3AED' },
              ]).map(({ key, label, color }) => {
                const max = Math.max(...chartData.map(d => d[key]), 1);
                const latest = chartData[chartData.length - 1]?.[key] ?? 0;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                        {label}
                      </p>
                      <span className="text-sm font-semibold" style={{ color }}>{latest}%</span>
                    </div>
                    <div className="flex items-end gap-1 h-20">
                      {chartData.map((d) => (
                        <div key={d.name} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full rounded-t-sm"
                            style={{ height: `${(d[key] / max) * 56}px`, background: color, opacity: 0.75 }}
                          />
                          <span className="text-[8px] text-muted-foreground truncate w-full text-center">{d.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="h-9">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          <TabsTrigger value="draft" className="text-xs">Drafts</TabsTrigger>
          <TabsTrigger value="scheduled" className="text-xs">Scheduled</TabsTrigger>
          <TabsTrigger value="sent" className="text-xs">Sent</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Campaigns Cards */}
      <div className="space-y-3">
        {filteredCampaigns.map((campaign) => {
          const cfg = statusConfig[campaign.status];
          const StatusIcon = cfg.icon;
          const campaignOpenRate = campaign.totalRecipients > 0
            ? (campaign.openCount / campaign.totalRecipients) * 100 : 0;
          const campaignClickRate = campaign.totalRecipients > 0
            ? (campaign.clickCount / campaign.totalRecipients) * 100 : 0;

          return (
            <Card key={campaign.id} className="group hover:shadow-sm transition-all p-0">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="p-2.5 rounded-xl bg-indigo-50 shrink-0">
                      <Mail className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/campaigns/${campaign.id}`}>
                          <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{campaign.name}</h3>
                        </Link>
                        <Badge variant="secondary" className={`text-xs h-5 ${cfg.className} gap-1`}>
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{campaign.subject}</p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        From: {campaign.fromName} &lt;{campaign.fromEmail}&gt;
                      </p>
                    </div>
                  </div>

                  {campaign.status === 'sent' ? (
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Recipients</p>
                        <p className="text-sm font-semibold text-foreground">{campaign.totalRecipients.toLocaleString()}</p>
                      </div>
                      <div className="text-center min-w-[80px]">
                        <p className="text-xs text-muted-foreground mb-1">Open Rate</p>
                        <p className="text-sm font-semibold text-indigo-600">{campaignOpenRate.toFixed(1)}%</p>
                        <Progress value={campaignOpenRate} className="h-1 mt-1" />
                      </div>
                      <div className="text-center min-w-[80px]">
                        <p className="text-xs text-muted-foreground mb-1">Click Rate</p>
                        <p className="text-sm font-semibold text-violet-600">{campaignClickRate.toFixed(1)}%</p>
                        <Progress value={campaignClickRate} className="h-1 mt-1" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                      {campaign.scheduledAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(campaign.scheduledAt).toLocaleDateString()}
                        </span>
                      )}
                      <span>Created {new Date(campaign.createdAt).toLocaleDateString()}</span>
                    </div>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild><Link to={`/campaigns/${campaign.id}`}>View Report</Link></DropdownMenuItem>
                      {campaign.status !== 'sent' && (
                        <DropdownMenuItem onClick={() => sendCampaignNow(campaign.id)}>Send Now</DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => addCampaign({
                        name: `${campaign.name} Copy`,
                        subject: campaign.subject,
                        fromName: campaign.fromName,
                        fromEmail: campaign.fromEmail,
                        status: 'draft',
                        totalRecipients: 0,
                        openCount: 0,
                        clickCount: 0,
                      })}>Duplicate</DropdownMenuItem>
                      <Separator className="my-1" />
                      <DropdownMenuItem className="text-destructive" onClick={() => {
                        if (window.confirm(`Delete ${campaign.name}?`)) deleteCampaign(campaign.id);
                      }}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredCampaigns.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No campaigns found</p>
            <Button size="sm" className="mt-4" onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Create Campaign
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
