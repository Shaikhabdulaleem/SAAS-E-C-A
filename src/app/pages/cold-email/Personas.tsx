import { useState, useEffect } from 'react';
import { Users, Search, MoreHorizontal, X, Edit3, Trash2, Linkedin, CheckCircle, Flame } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Progress } from '../../components/ui/progress';
import { Separator } from '../../components/ui/separator';
import { Switch } from '../../components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { apiRequest } from '../../lib/api';

interface Persona {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string;
  companyName: string;
  phone: string;
  signature: string;
  profilePhotoUrl: string;
  domain: string;
  warmupStatus: 'not_started' | 'warming' | 'ready' | 'paused';
  warmupDay: number;
  warmupTotal: number;
  healthScore: number;
  totalSent: number;
  replyRate: number;
  bounceRate: number;
  spamRate: number;
  linkedinConnected: boolean;
  linkedinProfileUrl: string;
  linkedinHeadline: string;
  linkedinBio: string;
  linkedinConnectionLimit: number;
  linkedinMessageLimit: number;
  linkedinConnections: number;
  linkedinMessagesSent: number;
  linkedinReplyRate: number;
}

const warmupConfig: Record<string, { label: string; className: string }> = {
  not_started: { label: 'Not Started', className: 'bg-muted text-muted-foreground' },
  warming: { label: 'Warming', className: 'bg-orange-50 text-orange-700' },
  ready: { label: 'Ready', className: 'bg-emerald-50 text-emerald-700' },
  paused: { label: 'Paused', className: 'bg-amber-50 text-amber-700' },
};

const domainColors = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
];

const avatarColors = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-sky-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-teal-500',
  'bg-orange-500',
];

function getDomainColorIndex(domain: string) {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % domainColors.length;
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function healthColor(score: number) {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function healthBarColor(score: number) {
  if (score >= 80) return '[&>[data-slot=progress-indicator]]:bg-emerald-500';
  if (score >= 50) return '[&>[data-slot=progress-indicator]]:bg-amber-500';
  return '[&>[data-slot=progress-indicator]]:bg-red-500';
}

export function Personas() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editModal, setEditModal] = useState<Persona | null>(null);
  const [linkedinModal, setLinkedinModal] = useState<Persona | null>(null);
  const [editForm, setEditForm] = useState({ jobTitle: '', companyName: '', phone: '', signature: '', profilePhotoUrl: '' });
  const [linkedinForm, setLinkedinForm] = useState({ profileUrl: '', headline: '', bio: '', connected: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchPersonas(); }, []);

  const fetchPersonas = async () => {
    try {
      const data = await apiRequest<Persona[]>('/provisioning/personas');
      setPersonas(data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (p: Persona) => {
    setEditForm({
      jobTitle: p.jobTitle,
      companyName: p.companyName,
      phone: p.phone || '',
      signature: p.signature || '',
      profilePhotoUrl: p.profilePhotoUrl || '',
    });
    setEditModal(p);
  };

  const openLinkedinModal = (p: Persona) => {
    setLinkedinForm({
      profileUrl: p.linkedinProfileUrl || '',
      headline: p.linkedinHeadline || '',
      bio: p.linkedinBio || '',
      connected: p.linkedinConnected,
    });
    setLinkedinModal(p);
  };

  const handleSaveEdit = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      const updated = await apiRequest<Persona>(`/provisioning/personas/${editModal.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      });
      setPersonas(prev => prev.map(p => p.id === editModal.id ? updated : p));
      setEditModal(null);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLinkedin = async () => {
    if (!linkedinModal) return;
    setSaving(true);
    try {
      const updated = await apiRequest<Persona>(`/provisioning/personas/${linkedinModal.id}/linkedin`, {
        method: 'PATCH',
        body: JSON.stringify(linkedinForm),
      });
      setPersonas(prev => prev.map(p => p.id === linkedinModal.id ? updated : p));
      setLinkedinModal(null);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this persona? This action cannot be undone.')) return;
    try {
      await apiRequest(`/provisioning/personas/${id}`, { method: 'DELETE' });
      setPersonas(prev => prev.filter(p => p.id !== id));
    } catch {
    }
  };

  const filtered = personas
    .filter(p => {
      if (filter === 'ready') return p.warmupStatus === 'ready';
      if (filter === 'warming') return p.warmupStatus === 'warming';
      if (filter === 'not_started') return p.warmupStatus === 'not_started';
      return true;
    })
    .filter(p => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return p.fullName.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
    });

  const totalPersonas = personas.length;
  const readyCount = personas.filter(p => p.warmupStatus === 'ready').length;
  const warmingCount = personas.filter(p => p.warmupStatus === 'warming').length;
  const linkedinCount = personas.filter(p => p.linkedinConnected).length;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditModal(null)} />
          <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-md border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground">Edit Persona</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{editModal.fullName}</p>
              </div>
              <button onClick={() => setEditModal(null)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Job Title</Label>
                <Input value={editForm.jobTitle} onChange={e => setEditForm(f => ({ ...f, jobTitle: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Company Name</Label>
                <Input value={editForm.companyName} onChange={e => setEditForm(f => ({ ...f, companyName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Phone</Label>
                <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="Business phone" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Signature</Label>
                <textarea
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={editForm.signature}
                  onChange={e => setEditForm(f => ({ ...f, signature: e.target.value }))}
                  placeholder="Your email signature..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Profile Photo URL</Label>
                <Input value={editForm.profilePhotoUrl} onChange={e => setEditForm(f => ({ ...f, profilePhotoUrl: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setEditModal(null)}>Cancel</Button>
                <Button size="sm" onClick={handleSaveEdit} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {linkedinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setLinkedinModal(null)} />
          <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-md border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground">LinkedIn Slot</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{linkedinModal.fullName}</p>
              </div>
              <button onClick={() => setLinkedinModal(null)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Profile URL</Label>
                <Input value={linkedinForm.profileUrl} onChange={e => setLinkedinForm(f => ({ ...f, profileUrl: e.target.value }))} placeholder="https://linkedin.com/in/..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Headline</Label>
                <Input value={linkedinForm.headline} onChange={e => setLinkedinForm(f => ({ ...f, headline: e.target.value }))} placeholder="Role at company" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Suggested Bio</Label>
                <textarea
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={linkedinForm.bio}
                  onChange={e => setLinkedinForm(f => ({ ...f, bio: e.target.value }))}
                  placeholder="Professional bio..."
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Mark as Connected</Label>
                <Switch checked={linkedinForm.connected} onCheckedChange={v => setLinkedinForm(f => ({ ...f, connected: v }))} />
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Connection Limit</p>
                  <p className="text-sm font-semibold text-foreground">{linkedinModal.linkedinConnectionLimit}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Message Limit</p>
                  <p className="text-sm font-semibold text-foreground">{linkedinModal.linkedinMessageLimit}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Connections</p>
                  <p className="text-sm font-semibold text-foreground">{linkedinModal.linkedinConnections}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Messages Sent</p>
                  <p className="text-sm font-semibold text-foreground">{linkedinModal.linkedinMessagesSent}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Reply Rate</p>
                  <p className="text-sm font-semibold text-foreground">{linkedinModal.linkedinReplyRate}%</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setLinkedinModal(null)}>Cancel</Button>
                <Button size="sm" onClick={handleSaveLinkedin} disabled={saving}>
                  {saving ? 'Saving...' : 'Save LinkedIn'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-foreground">Personas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your sending identities and LinkedIn profiles</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Personas', value: totalPersonas, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Ready to Send', value: readyCount, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Warming Up', value: warmingCount, icon: Flame, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'LinkedIn Connected', value: linkedinCount, icon: Linkedin, color: 'text-sky-600', bg: 'bg-sky-50' },
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

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Tabs value={filter} onValueChange={setFilter} className="flex-1">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="ready">Ready</TabsTrigger>
            <TabsTrigger value="warming">Warming</TabsTrigger>
            <TabsTrigger value="not_started">Not Started</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <Card><CardContent className="py-16 text-center"><p className="text-sm text-muted-foreground">Loading personas...</p></CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No personas found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(persona => {
            const colorIdx = getDomainColorIndex(persona.domain);
            const wCfg = warmupConfig[persona.warmupStatus];
            return (
              <Card key={persona.id} className="group hover:shadow-sm transition-all p-0">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-full ${avatarColors[colorIdx]} flex items-center justify-center text-white text-sm font-semibold shrink-0`}>
                      {getInitials(persona.fullName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-foreground">{persona.fullName}</h3>
                          <div className={`h-2 w-2 rounded-full ${persona.linkedinConnected ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditModal(persona)}>
                              <Edit3 className="h-3.5 w-3.5 mr-2" />
                              Edit Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openLinkedinModal(persona)}>
                              <Linkedin className="h-3.5 w-3.5 mr-2" />
                              View LinkedIn Slot
                            </DropdownMenuItem>
                            <Separator className="my-1" />
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(persona.id)}>
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <p className="text-xs text-muted-foreground">{persona.email}</p>
                      <p className="text-xs text-muted-foreground">{persona.jobTitle}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className={`text-[10px] h-5 ${domainColors[colorIdx]}`}>
                      {persona.domain}
                    </Badge>
                    <Badge variant="secondary" className={`text-[10px] h-5 ${wCfg.className} gap-1`}>
                      {persona.warmupStatus === 'warming' && <Flame className="h-3 w-3" />}
                      {persona.warmupStatus === 'ready' ? 'Ready' : persona.warmupStatus === 'warming' ? `Day ${persona.warmupDay}/${persona.warmupTotal}` : wCfg.label}
                    </Badge>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Health Score</span>
                      <span className={`font-semibold ${healthColor(persona.healthScore)}`}>{persona.healthScore}%</span>
                    </div>
                    <Progress value={persona.healthScore} className={`h-1.5 ${healthBarColor(persona.healthScore)}`} />
                  </div>

                  <Separator className="my-3" />

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Emails Sent</p>
                      <p className="text-xs font-semibold text-foreground">{persona.totalSent.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Reply Rate</p>
                      <p className="text-xs font-semibold text-foreground">{persona.replyRate}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Bounce Rate</p>
                      <p className={`text-xs font-semibold ${persona.bounceRate > 5 ? 'text-red-600' : 'text-foreground'}`}>{persona.bounceRate}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Spam Rate</p>
                      <p className={`text-xs font-semibold ${persona.spamRate > 1 ? 'text-red-600' : 'text-foreground'}`}>{persona.spamRate}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
