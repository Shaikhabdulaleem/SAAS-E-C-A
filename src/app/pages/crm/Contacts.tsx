import { useState, useEffect } from 'react';
import { useData } from '../../contexts/DataContext';
import { Link } from 'react-router';
import { Search, Plus, Mail, Phone, Building2, Tag, SlidersHorizontal, ChevronDown, MoreHorizontal, Users, X, Send, Package } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Checkbox } from '../../components/ui/checkbox';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { Separator } from '../../components/ui/separator';
import { Switch } from '../../components/ui/switch';

const AVATAR_COLORS = [
  'bg-indigo-500',
  'bg-violet-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-rose-500',
  'bg-amber-500',
];

const SERVICE_OPTIONS = [
  { key: 'email_marketing', label: 'Email Marketing' },
  { key: 'cold_outreach', label: 'Cold Outreach' },
  { key: 'ai_call_assistant', label: 'AI Call Assistant' },
  { key: 'advanced_analytics', label: 'Advanced Analytics' },
];

const statusConfig: Record<string, { label: string; className: string }> = {
  lead: { label: 'Lead', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  prospect: { label: 'Prospect', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  customer: { label: 'Customer', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  churned: { label: 'Churned', className: 'bg-red-50 text-red-700 border-red-200' },
};

export function Contacts({ hideHeader = false }: { hideHeader?: boolean }) {
  const { contacts, companies, addContact, deleteContact, addDeal, addActivity, apiError } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortAsc, setSortAsc] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    jobTitle: '',
    companyId: 'none',
    status: 'lead' as 'lead' | 'prospect' | 'customer' | 'churned',
    source: 'manual' as 'manual' | 'import' | 'campaign' | 'api',
    assignedTo: '',
    tags: '',
    interestedServices: [] as string[],
    marketingConsent: false,
    marketingConsentSource: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showColdOutreachModal, setShowColdOutreachModal] = useState(false);
  const [prospectLists, setProspectLists] = useState<Array<{ id: string; name: string }>>([]);
  const [outreachMode, setOutreachMode] = useState<'existing' | 'new'>('existing');
  const [selectedListId, setSelectedListId] = useState('');
  const [newListName, setNewListName] = useState('');
  const [outreachMessage, setOutreachMessage] = useState('');
  const [outreachSending, setOutreachSending] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredContacts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredContacts.map(c => c.id)));
  };

  const handleSendToColdOutreach = async () => {
    setOutreachSending(true);
    setOutreachMessage('');
    try {
      const body: Record<string, unknown> = { contactIds: [...selectedIds] };
      if (outreachMode === 'existing' && selectedListId) body.listId = selectedListId;
      if (outreachMode === 'new' && newListName.trim()) body.newListName = newListName.trim();
      const result = await apiRequest<{ created: number; skipped: number }>('/contacts/send-to-cold-outreach', { method: 'POST', body: JSON.stringify(body) });
      setOutreachMessage(`${result.created} contacts added, ${result.skipped} skipped`);
      setSelectedIds(new Set());
      setTimeout(() => { setShowColdOutreachModal(false); setOutreachMessage(''); }, 2000);
    } catch (err) {
      setOutreachMessage(err instanceof Error ? err.message : 'Failed');
    } finally {
      setOutreachSending(false);
    }
  };

  const openColdOutreachModal = async () => {
    setShowColdOutreachModal(true);
    try {
      const lists = await apiRequest<Array<{ id: string; name: string }>>('/cold-email/prospect-lists');
      setProspectLists(Array.isArray(lists) ? lists : []);
    } catch { setProspectLists([]); }
  };

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch =
      contact.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || contact.status === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    const left = `${a.firstName} ${a.lastName}`;
    const right = `${b.firstName} ${b.lastName}`;
    return sortAsc ? left.localeCompare(right) : right.localeCompare(left);
  });

  const getCompanyName = (companyId?: string) => {
    if (!companyId) return null;
    return companies.find(c => c.id === companyId)?.name || null;
  };

  const getAvatarColor = (id: string) => AVATAR_COLORS[Math.abs([...id].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % AVATAR_COLORS.length];

  const set = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => { const next = { ...e }; delete next[field]; return next; });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!form.firstName.trim()) nextErrors.firstName = 'First name is required';
    if (!form.lastName.trim()) nextErrors.lastName = 'Last name is required';
    if (!form.email.trim()) nextErrors.email = 'Email is required';
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }

    addContact({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      jobTitle: form.jobTitle.trim() || undefined,
      companyId: form.companyId === 'none' ? undefined : form.companyId,
      assignedTo: form.assignedTo,
      status: form.status,
      source: form.source,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      interestedServices: form.interestedServices,
      marketingConsent: form.marketingConsent,
      marketingConsentSource: form.marketingConsentSource.trim() || (form.marketingConsent ? 'manual' : undefined),
    });
    setShowModal(false);
    setForm({ firstName: '', lastName: '', email: '', phone: '', jobTitle: '', companyId: 'none', status: 'lead', source: 'manual', assignedTo: '', tags: '', interestedServices: [], marketingConsent: false, marketingConsentSource: '' });
    setErrors({});
  };

  const handleSendEmail = (contact: typeof contacts[number]) => {
    addActivity({
      type: 'email_sent',
      subject: `Sent email to ${contact.firstName} ${contact.lastName}`,
      body: `Email drafted for ${contact.email}`,
      contactId: contact.id,
      companyId: contact.companyId,
      createdBy: 'Current User',
    });
  };

  const handleCreateDeal = (contact: typeof contacts[number]) => {
    addDeal({
      title: `${contact.firstName} ${contact.lastName} - New Opportunity`,
      value: 0,
      currency: 'USD',
      stage: 'lead',
      companyId: contact.companyId,
      assignedTo: contact.assignedTo || '',
      status: 'open',
      probability: 10,
    });
  };

  const stats = [
    { label: 'Total', value: contacts.length, color: 'text-foreground' },
    { label: 'Leads', value: contacts.filter(c => c.status === 'lead').length, color: 'text-amber-600' },
    { label: 'Prospects', value: contacts.filter(c => c.status === 'prospect').length, color: 'text-sky-600' },
    { label: 'Customers', value: contacts.filter(c => c.status === 'customer').length, color: 'text-emerald-600' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-lg border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
              <div>
                <h2 className="text-base font-semibold text-foreground">Add Contact</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Create a new CRM contact</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>First Name</Label>
                  <Input value={form.firstName} onChange={e => set('firstName', e.target.value)} className={errors.firstName ? 'border-destructive' : ''} />
                  {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Last Name</Label>
                  <Input value={form.lastName} onChange={e => set('lastName', e.target.value)} className={errors.lastName ? 'border-destructive' : ''} />
                  {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={errors.email ? 'border-destructive' : ''} />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={e => set('phone', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Job Title</Label>
                  <Input value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Company</Label>
                  <Select value={form.companyId} onValueChange={v => set('companyId', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No company</SelectItem>
                      {companies.map(company => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => set('status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="churned">Churned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Tags</Label>
                <Input value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="high-value, decision-maker" />
              </div>
              <div className="space-y-1.5">
                <Label>Interested Services</Label>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_OPTIONS.map(svc => {
                    const selected = form.interestedServices.includes(svc.key);
                    return (
                      <button
                        key={svc.key}
                        type="button"
                        onClick={() => setForm(f => ({
                          ...f,
                          interestedServices: selected
                            ? f.interestedServices.filter(s => s !== svc.key)
                            : [...f.interestedServices, svc.key],
                        }))}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          selected ? 'bg-primary text-white border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                        }`}
                      >
                        <Package className="h-3 w-3" />
                        {svc.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Marketing Consent</Label>
                    <p className="text-xs text-muted-foreground">Required before this contact can receive Email Marketing campaigns.</p>
                  </div>
                  <Switch checked={form.marketingConsent} onCheckedChange={value => setForm(f => ({ ...f, marketingConsent: value }))} />
                </div>
                {form.marketingConsent && (
                  <div className="space-y-1.5">
                    <Label>Consent Source</Label>
                    <Input value={form.marketingConsentSource} onChange={e => set('marketingConsentSource', e.target.value)} placeholder="manual, signup form, import" />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border mt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" />Add Contact</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {apiError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {apiError}
        </div>
      )}

      {/* Header */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-foreground">Contacts</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage your customer relationships</p>
          </div>
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Contact
          </Button>
        </div>
      )}
      {hideHeader && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Contact
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(stat => (
          <Card key={stat.label} className="p-0">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`text-2xl font-semibold mt-0.5 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-0">
        <CardContent className="p-3 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 bg-muted/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9 bg-muted/50">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="churned">Churned</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}>
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contacts Table */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between px-5 py-2.5 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm text-foreground font-medium">{selectedIds.size} contact{selectedIds.size > 1 ? 's' : ''} selected</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>Clear</Button>
            <Button size="sm" onClick={() => void openColdOutreachModal()}>
              <Send className="h-3.5 w-3.5 mr-1.5" />Send to Cold Outreach
            </Button>
          </div>
        </div>
      )}

      {showColdOutreachModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowColdOutreachModal(false)} />
          <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-md border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground">Send to Cold Outreach</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedIds.size} contacts selected</p>
              </div>
              <button onClick={() => setShowColdOutreachModal(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => setOutreachMode('existing')} className={`text-xs px-3 py-1.5 rounded ${outreachMode === 'existing' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>Existing List</button>
                <button type="button" onClick={() => setOutreachMode('new')} className={`text-xs px-3 py-1.5 rounded ${outreachMode === 'new' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>New List</button>
              </div>
              {outreachMode === 'existing' ? (
                <div className="space-y-1.5">
                  <Label className="text-sm">Select Prospect List</Label>
                  <Select value={selectedListId} onValueChange={setSelectedListId}>
                    <SelectTrigger><SelectValue placeholder="Choose a list..." /></SelectTrigger>
                    <SelectContent>
                      {prospectLists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-sm">New List Name</Label>
                  <Input placeholder="e.g. Q3 Leads" value={newListName} onChange={e => setNewListName(e.target.value)} />
                </div>
              )}
              {outreachMessage && <p className={`text-xs text-center ${outreachMessage.includes('Failed') ? 'text-destructive' : 'text-emerald-600'}`}>{outreachMessage}</p>}
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => setShowColdOutreachModal(false)}>Cancel</Button>
                <Button size="sm" onClick={() => void handleSendToColdOutreach()} disabled={outreachSending || (outreachMode === 'existing' && !selectedListId) || (outreachMode === 'new' && !newListName.trim())}>
                  {outreachSending ? 'Sending...' : `Import ${selectedIds.size} Contacts`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{filteredContacts.length} contacts</span>
          </div>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground h-7 text-xs" onClick={() => setSortAsc(v => !v)}>
            Sort <ChevronDown className="h-3 w-3" />
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-3 w-8"><Checkbox checked={selectedIds.size === filteredContacts.length && filteredContacts.length > 0} onCheckedChange={toggleSelectAll} /></th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Contact</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Company</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Contact Info</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground hidden xl:table-cell">Interested In</th>
                <th className="px-5 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredContacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-3 py-3.5"><Checkbox checked={selectedIds.has(contact.id)} onCheckedChange={() => toggleSelect(contact.id)} /></td>
                  <td className="px-5 py-3.5">
                    <Link to={`/contacts/${contact.id}`} className="flex items-center gap-3">
                      <Avatar className={`h-9 w-9 ${getAvatarColor(contact.id)}`}>
                        <AvatarFallback className={`${getAvatarColor(contact.id)} text-white text-xs font-medium`}>
                          {contact.firstName[0]}{contact.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {contact.firstName} {contact.lastName}
                        </div>
                        {contact.jobTitle && (
                          <div className="text-xs text-muted-foreground">{contact.jobTitle}</div>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    {getCompanyName(contact.companyId) ? (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <span>{getCompanyName(contact.companyId)}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge
                      variant="outline"
                      className={`text-xs ${statusConfig[contact.status]?.className}`}
                    >
                      {statusConfig[contact.status]?.label}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    <div className="flex flex-col gap-1">
                      <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span>{contact.email}</span>
                      </a>
                      {contact.phone && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3 shrink-0" />
                          {contact.phone}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden xl:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(contact.interestedServices ?? []).slice(0, 2).map((svc: string) => {
                        const label = SERVICE_OPTIONS.find(s => s.key === svc)?.label ?? svc;
                        return (
                          <span key={svc} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs">
                            <Package className="h-2.5 w-2.5" />
                            {label}
                          </span>
                        );
                      })}
                      {(contact.interestedServices ?? []).length > 2 && (
                        <span className="text-xs text-muted-foreground">+{contact.interestedServices.length - 2}</span>
                      )}
                      {(contact.interestedServices ?? []).length === 0 && (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/contacts/${contact.id}`}>View Details</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSendEmail(contact)}>Send Email</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCreateDeal(contact)}>Create Deal</DropdownMenuItem>
                        <Separator className="my-1" />
                        <DropdownMenuItem className="text-destructive" onClick={() => {
                          if (window.confirm(`Delete ${contact.firstName} ${contact.lastName}?`)) deleteContact(contact.id);
                        }}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredContacts.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No contacts found</p>
              <p className="text-xs mt-1">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
