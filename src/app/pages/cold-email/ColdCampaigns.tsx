import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Plus, Mail, MoreHorizontal, X, Send, Eye, MessageSquare, AlertTriangle, Clock, CheckCircle, Play, Pause, Trash2, Target, BarChart2, Copy } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Progress } from '../../components/ui/progress';
import { Separator } from '../../components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { apiRequest } from '../../lib/api';

interface ColdCampaign {
  id: string;
  name: string;
  goal: string | null;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'error';
  totalProspects: number;
  sentCount: number;
  openCount: number;
  replyCount: number;
  positiveReplyCount: number;
  bounceCount: number;
  unsubCount: number;
  createdAt: string;
}

interface ProspectListOption {
  id: string;
  name: string;
  totalCount: number;
}

interface MailboxOption {
  id: string;
  email: string;
}

const statusConfig: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground', icon: Clock },
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700', icon: Play },
  paused: { label: 'Paused', className: 'bg-amber-50 text-amber-700', icon: Pause },
  completed: { label: 'Completed', className: 'bg-sky-50 text-sky-700', icon: CheckCircle },
  error: { label: 'Error', className: 'bg-red-50 text-red-700', icon: AlertTriangle },
};

const defaultForm = {
  name: '',
  goal: 'get_reply' as string,
  prospectListId: '',
  mailboxIds: [] as string[],
  trackOpens: true,
  trackClicks: false,
  customTrackingDomain: '',
  stopOnReply: true,
  stopOnUnsubscribe: true,
};

export function ColdCampaigns() {
  const [campaigns, setCampaigns] = useState<ColdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [prospectLists, setProspectLists] = useState<ProspectListOption[]>([]);
  const [mailboxes, setMailboxes] = useState<MailboxOption[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const result = await apiRequest<ColdCampaign[]>('/cold-email/campaigns');
      setCampaigns(result);
    } catch {} finally {
      setLoading(false);
    }
  };

  const fetchModalData = async () => {
    try {
      const [lists, mboxes] = await Promise.all([
        apiRequest<ProspectListOption[]>('/cold-email/prospect-lists'),
        apiRequest<MailboxOption[]>('/cold-email/mailboxes'),
      ]);
      setProspectLists(lists);
      setMailboxes(mboxes);
    } catch {}
  };

  const filteredCampaigns = campaigns.filter(c => filter === 'all' || c.status === filter);

  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const totalSent = campaigns.reduce((sum, c) => sum + c.sentCount, 0);
  const totalReplies = campaigns.reduce((sum, c) => sum + c.replyCount, 0);
  const avgReplyRate = totalSent > 0 ? (totalReplies / totalSent) * 100 : 0;

  const set = (field: string, value: string | boolean | string[]) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  };

  const toggleMailbox = (id: string) => {
    setForm(f => ({
      ...f,
      mailboxIds: f.mailboxIds.includes(id)
        ? f.mailboxIds.filter(m => m !== id)
        : [...f.mailboxIds, id],
    }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Campaign name is required';
    if (!form.prospectListId) e.prospectListId = 'Select a prospect list';
    if (form.mailboxIds.length === 0) e.mailboxIds = 'Select at least one mailbox';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    try {
      const newCampaign = await apiRequest<ColdCampaign>('/cold-email/campaigns', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setCampaigns(prev => [...prev, newCampaign]);
      setShowModal(false);
      setForm({ ...defaultForm });
      setErrors({});
    } catch {}
  };

  const handleActivate = async (id: string) => {
    try {
      const updated = await apiRequest<ColdCampaign>(`/cold-email/campaigns/${id}/activate`, { method: 'POST' });
      setCampaigns(prev => prev.map(c => c.id === id ? updated : c));
    } catch {}
  };

  const handlePause = async (id: string) => {
    try {
      const updated = await apiRequest<ColdCampaign>(`/cold-email/campaigns/${id}/pause`, { method: 'POST' });
      setCampaigns(prev => prev.map(c => c.id === id ? updated : c));
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this campaign?')) return;
    try {
      await apiRequest(`/cold-email/campaigns/${id}`, { method: 'DELETE' });
      setCampaigns(prev => prev.filter(c => c.id !== id));
    } catch {}
  };

  const handleDuplicate = async (id: string) => {
    try {
      const copy = await apiRequest<ColdCampaign>(`/cold-email/campaigns/${id}/duplicate`, { method: 'POST' });
      setCampaigns(prev => [copy, ...prev]);
    } catch {}
  };

  const openModal = () => {
    setShowModal(true);
    fetchModalData();
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-16 text-center">
        <p className="text-sm text-muted-foreground">Loading campaigns...</p>
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
                <h2 className="text-base font-semibold text-foreground">New Sequence</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Set up your cold email campaign</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Campaign Settings</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cc-name" className="text-sm">Campaign Name</Label>
                    <Input id="cc-name" placeholder="e.g. SaaS Founders Outreach" value={form.name} onChange={e => set('name', e.target.value)} className={errors.name ? 'border-destructive' : ''} />
                    {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Goal</Label>
                    <Select value={form.goal} onValueChange={v => set('goal', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="booked_meeting">Booked Meeting</SelectItem>
                        <SelectItem value="get_reply">Get Reply</SelectItem>
                        <SelectItem value="download">Download</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Prospect List</p>
                <div className="space-y-1.5">
                  <Label className="text-sm">Select List</Label>
                  <Select value={form.prospectListId} onValueChange={v => set('prospectListId', v)}>
                    <SelectTrigger className={errors.prospectListId ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Choose a prospect list" />
                    </SelectTrigger>
                    <SelectContent>
                      {prospectLists.map(pl => (
                        <SelectItem key={pl.id} value={pl.id}>{pl.name} ({pl.totalCount} prospects)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.prospectListId && <p className="text-xs text-destructive">{errors.prospectListId}</p>}
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Select Mailboxes</p>
                {errors.mailboxIds && <p className="text-xs text-destructive mb-2">{errors.mailboxIds}</p>}
                <div className="space-y-2">
                  {mailboxes.map(mb => (
                    <label key={mb.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors">
                      <input type="checkbox" checked={form.mailboxIds.includes(mb.id)} onChange={() => toggleMailbox(mb.id)} className="rounded border-input" />
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm text-foreground">{mb.email}</span>
                    </label>
                  ))}
                  {mailboxes.length === 0 && (
                    <p className="text-xs text-muted-foreground">No mailboxes available. Connect one first.</p>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Tracking</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Track Opens</Label>
                    <Switch checked={form.trackOpens} onCheckedChange={v => set('trackOpens', v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Track Clicks</Label>
                    <Switch checked={form.trackClicks} onCheckedChange={v => set('trackClicks', v)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cc-tracking-domain" className="text-sm">Custom Tracking Domain</Label>
                    <Input id="cc-tracking-domain" placeholder="track.yourdomain.com (optional)" value={form.customTrackingDomain} onChange={e => set('customTrackingDomain', e.target.value)} />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Compliance</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Stop on Reply</Label>
                    <Switch checked={form.stopOnReply} onCheckedChange={v => set('stopOnReply', v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Stop on Unsubscribe</Label>
                      <p className="text-xs text-muted-foreground">Always enabled for compliance</p>
                    </div>
                    <Switch checked={true} disabled />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border mt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" size="sm">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Create Sequence
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-foreground">Cold Email Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create and manage your cold email sequences</p>
        </div>
        <Button size="sm" onClick={openModal}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Sequence
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Campaigns', value: totalCampaigns.toString(), icon: BarChart2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Active', value: activeCampaigns.toString(), icon: Play, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Reply Rate', value: `${avgReplyRate.toFixed(1)}%`, icon: MessageSquare, color: 'text-sky-600', bg: 'bg-sky-50', sub: `${totalReplies.toLocaleString()} replies` },
          { label: 'Emails Sent', value: totalSent.toLocaleString(), icon: Send, color: 'text-violet-600', bg: 'bg-violet-50' },
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

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="h-9">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          <TabsTrigger value="draft" className="text-xs">Draft</TabsTrigger>
          <TabsTrigger value="active" className="text-xs">Active</TabsTrigger>
          <TabsTrigger value="paused" className="text-xs">Paused</TabsTrigger>
          <TabsTrigger value="completed" className="text-xs">Completed</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-3">
        {filteredCampaigns.map(campaign => {
          const cfg = statusConfig[campaign.status];
          const StatusIcon = cfg.icon;
          const replyRate = campaign.sentCount > 0 ? (campaign.replyCount / campaign.sentCount) * 100 : 0;

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
                        <Link to={`/cold-email/campaigns/${campaign.id}`}>
                          <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{campaign.name}</h3>
                        </Link>
                        <Badge variant="secondary" className={`text-xs h-5 ${cfg.className} gap-1`}>
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        {campaign.goal.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">{campaign.totalProspects} prospects</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Prospects</p>
                      <p className="text-sm font-semibold text-foreground">{campaign.totalProspects.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Sent</p>
                      <p className="text-sm font-semibold text-foreground">{campaign.sentCount.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Opens</p>
                      <p className="text-sm font-semibold text-foreground">{campaign.openCount.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Replies</p>
                      <p className="text-sm font-semibold text-sky-600">{campaign.replyCount.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Bounces</p>
                      <p className="text-sm font-semibold text-red-600">{campaign.bounceCount.toLocaleString()}</p>
                    </div>
                    <div className="text-center min-w-[80px]">
                      <p className="text-xs text-muted-foreground mb-1">Reply Rate</p>
                      <p className="text-sm font-semibold text-sky-600">{replyRate.toFixed(1)}%</p>
                      <Progress value={replyRate} className="h-1 mt-1" />
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={`/cold-email/campaigns/${campaign.id}`}>
                          <Eye className="h-3.5 w-3.5 mr-2" />
                          View
                        </Link>
                      </DropdownMenuItem>
                      {campaign.status === 'active' ? (
                        <DropdownMenuItem onClick={() => handlePause(campaign.id)}>
                          <Pause className="h-3.5 w-3.5 mr-2" />
                          Pause
                        </DropdownMenuItem>
                      ) : campaign.status !== 'completed' ? (
                        <DropdownMenuItem onClick={() => handleActivate(campaign.id)}>
                          <Play className="h-3.5 w-3.5 mr-2" />
                          Activate
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem onClick={() => void handleDuplicate(campaign.id)}>
                        <Copy className="h-3.5 w-3.5 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <Separator className="my-1" />
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(campaign.id)}>
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

      {filteredCampaigns.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No campaigns found</p>
            <Button size="sm" className="mt-4" onClick={openModal}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Sequence
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}