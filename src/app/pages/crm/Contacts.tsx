import { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { Link } from 'react-router';
import { Search, Plus, Mail, Phone, Building2, Tag, SlidersHorizontal, ChevronDown, MoreHorizontal, Users, X } from 'lucide-react';
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

const statusConfig: Record<string, { label: string; className: string }> = {
  lead: { label: 'Lead', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  prospect: { label: 'Prospect', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  customer: { label: 'Customer', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  churned: { label: 'Churned', className: 'bg-red-50 text-red-700 border-red-200' },
};

export function Contacts() {
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
    marketingConsent: false,
    marketingConsentSource: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      marketingConsent: form.marketingConsent,
      marketingConsentSource: form.marketingConsentSource.trim() || (form.marketingConsent ? 'manual' : undefined),
    });
    setShowModal(false);
    setForm({ firstName: '', lastName: '', email: '', phone: '', jobTitle: '', companyId: 'none', status: 'lead', source: 'manual', assignedTo: '', tags: '', marketingConsent: false, marketingConsentSource: '' });
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
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Contact</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Company</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Contact Info</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground hidden xl:table-cell">Tags</th>
                <th className="px-5 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredContacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-muted/20 transition-colors group">
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
                      {contact.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-xs">
                          <Tag className="h-2.5 w-2.5" />
                          {tag}
                        </span>
                      ))}
                      {contact.tags.length > 2 && (
                        <span className="text-xs text-muted-foreground">+{contact.tags.length - 2}</span>
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
