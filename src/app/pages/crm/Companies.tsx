import { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { Link } from 'react-router';
import { Search, Plus, Globe, Phone, Users, TrendingUp, Building2, MoreHorizontal, LayoutGrid, List, X } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';

const COMPANY_COLORS = [
  'from-indigo-500 to-violet-600',
  'from-sky-500 to-indigo-600',
  'from-violet-500 to-fuchsia-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
];

const sizeLabels: Record<string, string> = {
  '1-10': '1–10 emp.',
  '11-50': '11–50 emp.',
  '51-200': '51–200 emp.',
  '201-1000': '201–1K emp.',
  '1000+': '1K+ emp.',
};

const INDUSTRIES = [
  'Technology', 'SaaS', 'Finance', 'Healthcare', 'Retail',
  'Manufacturing', 'Consulting', 'Education', 'Media', 'Other',
];

const SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'] as const;

const emptyForm = {
  name: '', domain: '', industry: '', size: '' as '' | typeof SIZES[number],
  website: '', phone: '', assignedTo: '', tags: '',
};

export function Companies() {
  const { companies, contacts, deals, addCompany, updateCompany, deleteCompany, apiError } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [showModal, setShowModal] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (company.industry?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const getCompanyStats = (companyId: string) => {
    const companyContacts = contacts.filter(c => c.companyId === companyId);
    const companyDeals = deals.filter(d => d.companyId === companyId);
    const totalValue = companyDeals.reduce((sum, deal) => sum + deal.value, 0);
    return { contactCount: companyContacts.length, dealCount: companyDeals.length, totalValue };
  };

  const getColor = (id: string) => COMPANY_COLORS[parseInt(id) % COMPANY_COLORS.length];

  const set = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Company name is required';
    return e;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    const payload = {
      name: form.name.trim(),
      domain: form.domain.trim() || undefined,
      industry: form.industry || undefined,
      size: (form.size as typeof SIZES[number]) || undefined,
      website: form.website.trim() || undefined,
      phone: form.phone.trim() || undefined,
      assignedTo: form.assignedTo,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    };
    if (editingCompanyId) updateCompany(editingCompanyId, payload);
    else addCompany(payload);
    setShowModal(false);
    setEditingCompanyId(null);
    setForm(emptyForm);
    setErrors({});
  };

  const openAdd = () => {
    setEditingCompanyId(null);
    setForm(emptyForm);
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (company: typeof companies[number]) => {
    setEditingCompanyId(company.id);
    setForm({
      name: company.name,
      domain: company.domain ?? '',
      industry: company.industry ?? '',
      size: (company.size ?? '') as '' | typeof SIZES[number],
      website: company.website ?? '',
      phone: company.phone ?? '',
      assignedTo: company.assignedTo ?? '',
      tags: company.tags.join(', '),
    });
    setErrors({});
    setShowModal(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {apiError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {apiError}
        </div>
      )}

      {/* Add Company Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-lg border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
              <div>
                <h2 className="text-base font-semibold text-foreground">{editingCompanyId ? 'Edit Company' : 'Add Company'}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{editingCompanyId ? 'Update company details' : 'Add a new company to your CRM'}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Company Name */}
              <div className="space-y-1.5">
                <Label htmlFor="co-name">Company Name <span className="text-destructive">*</span></Label>
                <Input
                  id="co-name"
                  placeholder="Company name"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>

              {/* Domain + Website */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="co-domain">Domain</Label>
                  <Input
                    id="co-domain"
                    placeholder="company.com"
                    value={form.domain}
                    onChange={e => set('domain', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="co-website">Website</Label>
                  <Input
                    id="co-website"
                    placeholder="https://company.com"
                    value={form.website}
                    onChange={e => set('website', e.target.value)}
                  />
                </div>
              </div>

              {/* Industry + Size */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Industry</Label>
                  <Select value={form.industry} onValueChange={v => set('industry', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map(ind => (
                        <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Company Size</Label>
                  <Select value={form.size} onValueChange={v => set('size', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {SIZES.map(s => (
                        <SelectItem key={s} value={s}>{sizeLabels[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <Label htmlFor="co-phone">Phone</Label>
                <Input
                  id="co-phone"
                  placeholder="Business phone"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                />
              </div>

              {/* Assigned To */}
              <div className="space-y-1.5">
                <Label htmlFor="co-assigned">Assigned To</Label>
                <Select value={form.assignedTo} onValueChange={v => set('assignedTo', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <Label htmlFor="co-tags">Tags</Label>
                <Input
                  id="co-tags"
                  placeholder="enterprise, saas (comma separated)"
                  value={form.tags}
                  onChange={e => set('tags', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Separate multiple tags with commas</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border mt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" size="sm">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  {editingCompanyId ? 'Save Company' : 'Add Company'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-foreground">Companies</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your business accounts</p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Company
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-0">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Companies</p>
            <p className="text-2xl font-semibold text-foreground mt-0.5">{companies.length}</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Contacts</p>
            <p className="text-2xl font-semibold text-violet-600 mt-0.5">{contacts.length}</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active Deals</p>
            <p className="text-2xl font-semibold text-indigo-600 mt-0.5">{deals.filter(d => d.status === 'open').length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + View Toggle */}
      <Card className="p-0">
        <CardContent className="p-3 flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 bg-muted/50"
            />
          </div>
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setView('grid')}
              className={`p-1.5 rounded-md transition-colors ${view === 'grid' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-1.5 rounded-md transition-colors ${view === 'list' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Grid View */}
      {view === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCompanies.map((company) => {
            const stats = getCompanyStats(company.id);
            return (
              <Card key={company.id} className="group hover:shadow-md transition-all hover:border-primary/20 p-0 overflow-hidden">
                <CardContent className="p-0">
                  <div className={`h-1.5 w-full bg-gradient-to-r ${getColor(company.id)}`} />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <Link to={`/companies/${company.id}`} className="flex items-center gap-3">
                        <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${getColor(company.id)} flex items-center justify-center text-white font-semibold shrink-0`}>
                          {company.name[0]}
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{company.name}</h3>
                          {company.industry && <p className="text-xs text-muted-foreground">{company.industry}</p>}
                        </div>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild><Link to={`/companies/${company.id}`}>View Details</Link></DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(company)}>Edit</DropdownMenuItem>
                          <Separator className="my-1" />
                          <DropdownMenuItem className="text-destructive" onClick={() => {
                            if (window.confirm(`Delete ${company.name}?`)) deleteCompany(company.id);
                          }}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="space-y-1.5 mb-4">
                      {company.website && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Globe className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{company.website.replace(/^https?:\/\//, '')}</span>
                        </div>
                      )}
                      {company.phone && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          {company.phone}
                        </div>
                      )}
                      {company.size && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5 shrink-0" />
                          {sizeLabels[company.size]}
                        </div>
                      )}
                    </div>

                    <Separator className="mb-4" />

                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Contacts</p>
                        <p className="text-base font-semibold text-foreground">{stats.contactCount}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Deals</p>
                        <p className="text-base font-semibold text-foreground">{stats.dealCount}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Value</p>
                        <p className="text-base font-semibold text-emerald-600">
                          {stats.totalValue > 0 ? `$${(stats.totalValue / 1000).toFixed(0)}K` : '—'}
                        </p>
                      </div>
                    </div>

                    {company.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {company.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs h-5 px-1.5">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredCompanies.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No companies found</p>
              <Button size="sm" className="mt-4" onClick={openAdd}>
                <Plus className="h-4 w-4 mr-1.5" />Add Company
              </Button>
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Company</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Industry</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Size</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Contacts</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Deals</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Value</th>
                  <th className="px-5 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCompanies.map((company) => {
                  const stats = getCompanyStats(company.id);
                  return (
                    <tr key={company.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-5 py-3.5">
                        <Link to={`/companies/${company.id}`} className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${getColor(company.id)} flex items-center justify-center text-white text-xs font-semibold shrink-0`}>
                            {company.name[0]}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{company.name}</div>
                            {company.domain && <div className="text-xs text-muted-foreground">{company.domain}</div>}
                          </div>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        {company.industry ? <Badge variant="secondary" className="text-xs">{company.industry}</Badge> : <span className="text-muted-foreground/50 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground hidden lg:table-cell">
                        {company.size ? sizeLabels[company.size] : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-1 text-sm text-foreground">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />{stats.contactCount}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-1 text-sm text-foreground">
                          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />{stats.dealCount}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <span className="text-sm font-medium text-emerald-600">
                          {stats.totalValue > 0 ? `$${stats.totalValue.toLocaleString()}` : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild><Link to={`/companies/${company.id}`}>View Details</Link></DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(company)}>Edit</DropdownMenuItem>
                            <Separator className="my-1" />
                            <DropdownMenuItem className="text-destructive" onClick={() => {
                              if (window.confirm(`Delete ${company.name}?`)) deleteCompany(company.id);
                            }}>Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
