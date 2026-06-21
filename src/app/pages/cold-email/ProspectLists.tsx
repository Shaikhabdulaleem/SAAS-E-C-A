import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Plus, Users, MoreHorizontal, X, List, CheckCircle, AlertCircle, AlertTriangle, ArrowLeft, Upload, Trash2, Download, Search } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { apiRequest } from '../../lib/api';

interface Prospect {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
  jobTitle: string | null;
  validationStatus: 'valid' | 'invalid' | 'risky' | 'pending';
}

interface ProspectList {
  id: string;
  name: string;
  totalCount: number;
  validCount: number;
  invalidCount: number;
  riskyCount: number;
  createdAt: string;
}

const validationConfig: Record<string, { label: string; className: string }> = {
  valid: { label: 'Valid', className: 'bg-emerald-50 text-emerald-700' },
  invalid: { label: 'Invalid', className: 'bg-red-50 text-red-700' },
  risky: { label: 'Risky', className: 'bg-amber-50 text-amber-700' },
  pending: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
};

export function ProspectLists() {
  const [lists, setLists] = useState<ProspectList[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddProspectsModal, setShowAddProspectsModal] = useState<string | null>(null);
  const [viewingListId, setViewingListId] = useState<string | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [prospectsLoading, setProspectsLoading] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createError, setCreateError] = useState('');
  const [bulkText, setBulkText] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const result = await apiRequest<ProspectList[]>('/cold-email/prospect-lists');
      setLists(result);
    } catch {} finally {
      setLoading(false);
    }
  };

  const totalLists = lists.length;
  const totalProspects = lists.reduce((sum, l) => sum + l.totalCount, 0);
  const totalValid = lists.reduce((sum, l) => sum + l.validCount, 0);
  const totalInvalid = lists.reduce((sum, l) => sum + l.invalidCount, 0);

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) { setCreateError('List name is required'); return; }
    try {
      const newList = await apiRequest<ProspectList>('/cold-email/prospect-lists', {
        method: 'POST',
        body: JSON.stringify({ name: createName.trim() }),
      });
      setLists(prev => [...prev, newList]);
      setShowCreateModal(false);
      setCreateName('');
      setCreateError('');
    } catch {}
  };

  const handleDeleteList = async (id: string) => {
    if (!window.confirm('Delete this prospect list?')) return;
    try {
      await apiRequest(`/cold-email/prospect-lists/${id}`, { method: 'DELETE' });
      setLists(prev => prev.filter(l => l.id !== id));
    } catch {}
  };

  const handleViewProspects = async (id: string) => {
    setViewingListId(id);
    setProspectsLoading(true);
    try {
      const result = await apiRequest<Prospect[]>(`/cold-email/prospect-lists/${id}/prospects`);
      setProspects(result);
    } catch {} finally {
      setProspectsLoading(false);
    }
  };

  const handleDeleteProspect = async (listId: string, prospectId: string) => {
    if (!window.confirm('Delete this prospect?')) return;
    try {
      await apiRequest(`/cold-email/prospect-lists/${listId}/prospects/${prospectId}`, { method: 'DELETE' });
      setProspects(prev => prev.filter(prospect => prospect.id !== prospectId));
      await fetchData();
    } catch {}
  };

  const handleExportCsv = async (listId: string) => {
    try {
      const prospects = await apiRequest<Prospect[]>(`/cold-email/prospect-lists/${listId}/prospects`);
      const header = 'email,firstName,lastName,company,jobTitle,status';
      const rows = prospects.map(p => `${p.email},${p.firstName ?? ''},${p.lastName ?? ''},${p.companyName ?? ''},${p.jobTitle ?? ''},${p.validationStatus}`);
      const csv = [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prospects-${listId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
  };

  const handleAddProspects = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddProspectsModal || !bulkText.trim()) return;
    const lines = bulkText.trim().split('\n').filter(l => l.trim());
    const prospects = lines.map(line => {
      const parts = line.split(',').map(p => p.trim());
      return {
        email: parts[0] || '',
        firstName: parts[1] || '',
        lastName: parts[2] || '',
        companyName: parts[3] || '',
        jobTitle: parts[4] || '',
      };
    });
    try {
      await apiRequest(`/cold-email/prospect-lists/${showAddProspectsModal}/prospects`, {
        method: 'POST',
        body: JSON.stringify({ prospects }),
      });
      setShowAddProspectsModal(null);
      setBulkText('');
      fetchData();
    } catch {}
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-16 text-center">
        <p className="text-sm text-muted-foreground">Loading prospect lists...</p>
      </div>
    );
  }

  if (viewingListId) {
    const list = lists.find(l => l.id === viewingListId);
    return (
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setViewingListId(null); setProspects([]); }}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back
          </Button>
          <div>
            <h1 className="text-foreground">{list?.name ?? 'Prospects'}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{list?.totalCount ?? 0} prospects in this list</p>
          </div>
        </div>

        {prospectsLoading ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">Loading prospects...</p>
          </div>
        ) : (
          <Card className="p-0">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Email</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Company</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Job Title</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prospects.map(p => {
                      const vCfg = validationConfig[p.validationStatus];
                      return (
                        <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                          <td className="px-4 py-3 text-foreground">{p.email}</td>
                          <td className="px-4 py-3 text-foreground">{p.firstName} {p.lastName}</td>
                          <td className="px-4 py-3 text-muted-foreground">{p.companyName ?? '-'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{p.jobTitle ?? '-'}</td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className={`text-xs h-5 ${vCfg.className}`}>{vCfg.label}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteProspect(viewingListId, p.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {prospects.length === 0 && (
                  <div className="py-12 text-center">
                    <p className="text-sm text-muted-foreground">No prospects in this list</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-md border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground">Create Prospect List</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Create a new list to organize your prospects</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateList} className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pl-name" className="text-sm">List Name</Label>
                <Input id="pl-name" placeholder="e.g. SaaS Founders Q3" value={createName} onChange={e => { setCreateName(e.target.value); setCreateError(''); }} className={createError ? 'border-destructive' : ''} />
                {createError && <p className="text-xs text-destructive">{createError}</p>}
              </div>
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border mt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                <Button type="submit" size="sm">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Create List
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddProspectsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddProspectsModal(null)} />
          <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-lg border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground">Add Prospects</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Paste prospects, one per line</p>
              </div>
              <button onClick={() => setShowAddProspectsModal(null)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddProspects} className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Upload CSV File</Label>
                <input type="file" accept=".csv,.txt" className="block w-full text-sm text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border file:border-input file:text-sm file:font-medium file:bg-background hover:file:bg-muted cursor-pointer" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const text = ev.target?.result as string;
                    const lines = text.split('\n').filter(l => l.trim());
                    const hasHeader = lines[0]?.toLowerCase().includes('email');
                    const dataLines = hasHeader ? lines.slice(1) : lines;
                    setBulkText(dataLines.join('\n'));
                  };
                  reader.readAsText(file);
                }} />
                <p className="text-xs text-muted-foreground">CSV with columns: email, firstName, lastName, company, jobTitle</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Or Paste Manually</Label>
                <textarea rows={6} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono" placeholder={"alex@example.com, Alex, Lee, Example Co, CEO\njane@example.org, Jane, Smith, Example Org, CTO"} value={bulkText} onChange={e => setBulkText(e.target.value)} />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border mt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddProspectsModal(null)}>Cancel</Button>
                <Button type="submit" size="sm">
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Add Prospects
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-foreground">Prospect Lists</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your prospect lists for cold outreach</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/cold-email/email-finder"><Search className="h-4 w-4 mr-1.5" />Find Emails</Link>
          </Button>
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Create List
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Lists', value: totalLists.toString(), icon: List, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Total Prospects', value: totalProspects.toLocaleString(), icon: Users, color: 'text-sky-600', bg: 'bg-sky-50' },
          { label: 'Valid Emails', value: totalValid.toLocaleString(), icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Invalid Emails', value: totalInvalid.toLocaleString(), icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
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
        {lists.map(list => (
          <Card key={list.id} className="group hover:shadow-sm transition-all p-0">
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="p-2.5 rounded-xl bg-indigo-50 shrink-0">
                    <Users className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{list.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Created {new Date(list.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-sm font-semibold text-foreground">{list.totalCount.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Valid</p>
                    <p className="text-sm font-semibold text-emerald-600">{list.validCount.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Invalid</p>
                    <p className="text-sm font-semibold text-red-600">{list.invalidCount.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Risky</p>
                    <p className="text-sm font-semibold text-amber-600">{list.riskyCount.toLocaleString()}</p>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleViewProspects(list.id)}>
                      <Users className="h-3.5 w-3.5 mr-2" />
                      View Prospects
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowAddProspectsModal(list.id)}>
                      <Plus className="h-3.5 w-3.5 mr-2" />
                      Add Prospects
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void handleExportCsv(list.id)}>
                      <Download className="h-3.5 w-3.5 mr-2" />
                      Export CSV
                    </DropdownMenuItem>
                    <Separator className="my-1" />
                    <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteList(list.id)}>
                      <AlertCircle className="h-3.5 w-3.5 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {lists.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No prospect lists yet</p>
            <Button size="sm" className="mt-4" onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Create List
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
