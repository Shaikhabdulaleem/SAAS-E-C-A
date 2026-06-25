import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Search, Plus, UserPlus, Building2, CheckCircle, AlertTriangle, XCircle, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Checkbox } from '../../components/ui/checkbox';
import { apiRequest } from '../../lib/api';

interface FinderResult {
  apolloId?: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  title: string;
  companyName: string;
  emailStatus: string;
  linkedinUrl?: string | null;
  city?: string | null;
  country?: string | null;
  hasEmail?: boolean;
  needsEnrichment?: boolean;
}

interface ProspectList {
  id: string;
  name: string;
}

const statusBadge = (status: string) => {
  if (status === 'verified') return <Badge className="bg-emerald-50 text-emerald-700 text-xs">Verified</Badge>;
  if (status === 'guessed') return <Badge className="bg-amber-50 text-amber-700 text-xs">Guessed</Badge>;
  if (status === 'available') return <Badge className="bg-blue-50 text-blue-700 text-xs">Has Email</Badge>;
  return <Badge className="bg-red-50 text-red-700 text-xs">Unavailable</Badge>;
};

export function EmailFinder() {
  const [hasCredential, setHasCredential] = useState<boolean | null>(null);
  const [finderMode, setFinderMode] = useState<'search' | 'match'>('search');
  const [domain, setDomain] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [titles, setTitles] = useState('');
  const [locations, setLocations] = useState('');
  const [perPage, setPerPage] = useState('25');
  const [results, setResults] = useState<FinderResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searching, setSearching] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTarget, setSaveTarget] = useState<'list' | 'crm'>('list');
  const [prospectLists, setProspectLists] = useState<ProspectList[]>([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [newListName, setNewListName] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [resultMode, setResultMode] = useState<'search' | 'api_search' | 'enriched'>('search');
  const [enriching, setEnriching] = useState(false);

  // Match mode fields
  const [matchFirstName, setMatchFirstName] = useState('');
  const [matchLastName, setMatchLastName] = useState('');
  const [matchNames, setMatchNames] = useState('');

  useEffect(() => {
    apiRequest<any>('/cold-email/email-finder/credential')
      .then(data => setHasCredential(!!data))
      .catch(() => setHasCredential(false));
  }, []);

  const handleSearch = async () => {
    setSearching(true);
    setSearchError('');
    setResults([]);
    setSelectedIndices(new Set());
    try {
      const payload: Record<string, unknown> = finderMode === 'match'
        ? { mode: 'match', domain, firstName: matchFirstName, lastName: matchLastName, names: matchNames }
        : { mode: 'search', domain, companyName, titles, locations, perPage: Number(perPage) };

      const data = await apiRequest<{ results: FinderResult[]; totalCount: number; mode?: string }>('/cold-email/email-finder/search', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setResults(data.results ?? []);
      setTotalCount(data.totalCount ?? 0);
      setResultMode(data.mode ?? 'search');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Search failed';
      if (msg.includes('403') || msg.includes('free plan') || msg.includes('API_INACCESSIBLE') || msg.includes('not accessible')) {
        setSearchError('apollo_paid_required');
      } else {
        setSearchError(msg);
      }
    } finally {
      setSearching(false);
    }
  };

  const handleEnrichSelected = async () => {
    const ids = [...selectedIndices].map(i => results[i]?.apolloId).filter(Boolean);
    if (ids.length === 0) return;
    setEnriching(true);
    setSearchError('');
    try {
      const data = await apiRequest<{ results: FinderResult[]; totalCount: number; mode: string }>('/cold-email/email-finder/search', {
        method: 'POST',
        body: JSON.stringify({ mode: 'enrich', apolloIds: ids }),
      });
      const enrichedMap = new Map((data.results ?? []).map(r => [r.apolloId, r]));
      setResults(prev => prev.map(r => {
        const enriched = r.apolloId ? enrichedMap.get(r.apolloId) : undefined;
        return enriched ? { ...r, ...enriched } : r;
      }));
      setResultMode('enriched');
      setSelectedIndices(new Set());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Enrichment failed';
      if (msg.includes('403') || msg.includes('not accessible')) {
        setSearchError('apollo_paid_required');
      } else {
        setSearchError(msg);
      }
    } finally {
      setEnriching(false);
    }
  };

  const toggleSelect = (i: number) => {
    setSelectedIndices(prev => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next; });
  };
  const toggleSelectAll = () => {
    const selectable = results.map((_, i) => i).filter(i => results[i].email || results[i].hasEmail);
    if (selectedIndices.size === selectable.length) setSelectedIndices(new Set());
    else setSelectedIndices(new Set(selectable));
  };

  const openSaveModal = async (target: 'list' | 'crm') => {
    setSaveTarget(target);
    setShowSaveModal(true);
    setSaveMessage('');
    if (target === 'list') {
      try {
        const lists = await apiRequest<ProspectList[]>('/cold-email/prospect-lists');
        setProspectLists(Array.isArray(lists) ? lists : []);
      } catch { setProspectLists([]); }
    }
  };

  const handleSave = async () => {
    const selected = [...selectedIndices].map(i => results[i]).filter(r => r.email);
    if (selected.length === 0) return;
    setSaving(true);
    setSaveMessage('');
    try {
      if (saveTarget === 'list') {
        const body: Record<string, unknown> = {
          prospects: selected.map(r => ({ email: r.email, firstName: r.firstName, lastName: r.lastName, companyName: r.companyName, jobTitle: r.title })),
        };
        if (selectedListId) body.listId = selectedListId;
        if (newListName.trim()) body.newListName = newListName.trim();
        const result = await apiRequest<{ created: number; skipped: number }>('/cold-email/email-finder/save-to-list', { method: 'POST', body: JSON.stringify(body) });
        setSaveMessage(`${result.created} added to prospect list`);
      } else {
        const result = await apiRequest<{ created: number; skipped: number }>('/cold-email/email-finder/save-to-crm', {
          method: 'POST',
          body: JSON.stringify({ prospects: selected.map(r => ({ email: r.email, firstName: r.firstName, lastName: r.lastName, companyName: r.companyName, title: r.title })) }),
        });
        setSaveMessage(`${result.created} contacts created in CRM`);
      }
      setSelectedIndices(new Set());
      setTimeout(() => { setShowSaveModal(false); setSaveMessage(''); }, 2000);
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [connecting, setConnecting] = useState(false);

  const handleConnectApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    setConnecting(true);
    try {
      await apiRequest('/cold-email/email-finder/credential', {
        method: 'POST',
        body: JSON.stringify({ apiKey: apiKeyInput, providerType: 'apollo' }),
      });
      setHasCredential(true);
      setApiKeyInput('');
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Failed to connect API key');
    } finally {
      setConnecting(false);
    }
  };

  if (hasCredential === false) {
    return (
      <div className="max-w-md mx-auto py-16 space-y-5">
        <div className="text-center space-y-2">
          <Search className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <h2 className="text-lg font-semibold">Connect Apollo.io</h2>
          <p className="text-sm text-muted-foreground">Enter your Apollo API key to start finding prospect emails.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Apollo API Key</Label>
          <Input
            type="password"
            placeholder="Paste your Apollo.io API key"
            value={apiKeyInput}
            onChange={e => setApiKeyInput(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Find it at Apollo.io → Settings → Integrations → API Keys
          </p>
        </div>
        <Button onClick={handleConnectApiKey} disabled={connecting || !apiKeyInput.trim()} className="w-full">
          {connecting ? 'Connecting...' : 'Connect & Start Searching'}
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowSaveModal(false)} />
          <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-md border border-border">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold">{saveTarget === 'list' ? 'Add to Prospect List' : 'Save to CRM'}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{selectedIndices.size} prospects selected</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              {saveTarget === 'list' && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Existing List</Label>
                    <Select value={selectedListId} onValueChange={v => { setSelectedListId(v); setNewListName(''); }}>
                      <SelectTrigger><SelectValue placeholder="Select list..." /></SelectTrigger>
                      <SelectContent>{prospectLists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="text-center text-xs text-muted-foreground">or</div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Create New List</Label>
                    <Input placeholder="List name" value={newListName} onChange={e => { setNewListName(e.target.value); setSelectedListId(''); }} />
                  </div>
                </>
              )}
              {saveTarget === 'crm' && <p className="text-sm text-muted-foreground">This will create new CRM Contact records for each selected prospect. Existing contacts (by email) will be skipped.</p>}
              {saveMessage && <p className={`text-xs text-center ${saveMessage.includes('failed') ? 'text-destructive' : 'text-emerald-600'}`}>{saveMessage}</p>}
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => setShowSaveModal(false)}>Cancel</Button>
                <Button size="sm" onClick={() => void handleSave()} disabled={saving || (saveTarget === 'list' && !selectedListId && !newListName.trim())}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-xl font-semibold">Email Finder</h1>
        <p className="text-sm text-muted-foreground mt-1">Find prospect emails using Apollo.io</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFinderMode('search')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${finderMode === 'search' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              Search by Company
            </button>
            <button
              onClick={() => setFinderMode('match')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${finderMode === 'match' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              Find by Name (Free Plan)
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {finderMode === 'search' ? (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Domain</Label>
                <Input placeholder="company.com" value={domain} onChange={e => setDomain(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Company Name</Label>
                <Input placeholder="Acme Inc" value={companyName} onChange={e => setCompanyName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Job Titles</Label>
                <Input placeholder="CEO, VP Sales" value={titles} onChange={e => setTitles(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Location</Label>
                <Input placeholder="United Kingdom" value={locations} onChange={e => setLocations(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Results</Label>
                <div className="flex gap-2">
                  <Select value={perPage} onValueChange={setPerPage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => void handleSearch()} disabled={searching}>
                    <Search className="h-4 w-4 mr-1.5" />{searching ? 'Searching...' : 'Search'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                Works on Apollo free plans. Enter a person's name + company domain to find their email, or paste multiple names.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">First Name</Label>
                  <Input placeholder="Patrick" value={matchFirstName} onChange={e => setMatchFirstName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Last Name</Label>
                  <Input placeholder="Collison" value={matchLastName} onChange={e => setMatchLastName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Company Domain</Label>
                  <Input placeholder="stripe.com" value={domain} onChange={e => setDomain(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Or paste multiple names (one per line)</Label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={"Patrick Collison\nJohn Collison\nClaire Hughes Johnson"}
                  value={matchNames}
                  onChange={e => setMatchNames(e.target.value)}
                />
              </div>
              <Button onClick={() => void handleSearch()} disabled={searching || (!matchFirstName.trim() && !matchNames.trim()) || !domain.trim()}>
                <Search className="h-4 w-4 mr-1.5" />{searching ? 'Finding...' : 'Find Emails'}
              </Button>
            </div>
          )}
          {searchError === 'apollo_paid_required' ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
              <p className="text-sm font-semibold text-amber-800">Apollo API requires a paid plan</p>
              <p className="text-xs text-amber-700">
                Apollo.io has restricted all API endpoints (search, match) to paid plans only.
                Your API key is connected and valid, but you need to upgrade your Apollo account to use Email Finder.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <a href="https://app.apollo.io/" target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline">Upgrade Apollo Plan</Button>
                </a>
                <Button size="sm" variant="outline" onClick={() => { setSearchError(''); window.location.href = '/cold-email/prospects'; }}>
                  Import CSV Instead
                </Button>
              </div>
            </div>
          ) : searchError ? (
            <p className="text-xs text-destructive mt-3">{searchError}</p>
          ) : null}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <>
          {resultMode === 'api_search' && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-700">
              Search results found! Last names are partially hidden and emails are not shown yet.
              Select people and click <strong>"Reveal Emails"</strong> to get their full contact info (uses Apollo credits).
            </div>
          )}

          {selectedIndices.size > 0 && (
            <div className="flex items-center justify-between px-5 py-2.5 bg-primary/5 border border-primary/20 rounded-lg">
              <span className="text-sm font-medium">{selectedIndices.size} selected</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelectedIndices(new Set())}>Clear</Button>
                {resultMode === 'api_search' && (
                  <Button size="sm" variant="secondary" onClick={() => void handleEnrichSelected()} disabled={enriching}>
                    {enriching ? 'Revealing...' : 'Reveal Emails'}
                  </Button>
                )}
                {results.some(r => r.email) && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => void openSaveModal('crm')}>
                      <UserPlus className="h-3.5 w-3.5 mr-1.5" />Save to CRM
                    </Button>
                    <Button size="sm" onClick={() => void openSaveModal('list')}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" />Add to Prospect List
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          <Card className="overflow-hidden p-0">
            <CardHeader className="pb-0 px-5 pt-4">
              <CardDescription>{totalCount} results found</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-3 py-3 w-8"><Checkbox checked={selectedIndices.size > 0 && selectedIndices.size === results.filter(r => r.email || r.hasEmail).length} onCheckedChange={toggleSelectAll} /></th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Company</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {results.map((r, i) => (
                      <tr key={i} className="hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-3">{(r.email || r.hasEmail) && <Checkbox checked={selectedIndices.has(i)} onCheckedChange={() => toggleSelect(i)} />}</td>
                        <td className="px-4 py-3 text-sm font-medium">{r.firstName} {r.lastName}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {r.email
                            ? r.email
                            : r.hasEmail
                              ? <span className="text-blue-500 italic text-xs">Click "Reveal Emails"</span>
                              : <span className="text-red-400 italic text-xs">No email</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{r.title ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{r.companyName}</td>
                        <td className="px-4 py-3">{statusBadge(r.emailStatus)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!searching && results.length === 0 && hasCredential && (
        <Card>
          <CardContent className="py-16 text-center">
            <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Search for prospects by domain, company, or job title</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
