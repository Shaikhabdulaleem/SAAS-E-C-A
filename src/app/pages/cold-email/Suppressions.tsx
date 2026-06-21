import { useState, useEffect } from 'react';
import { Ban, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { apiRequest } from '../../lib/api';

interface Suppression { id: string; email: string; source: string; createdAt: string; }

const sourceColors: Record<string, string> = { bounce: 'bg-red-50 text-red-700', unsubscribe: 'bg-amber-50 text-amber-700', manual: 'bg-blue-50 text-blue-700', complaint: 'bg-purple-50 text-purple-700' };

export function Suppressions() {
  const [entries, setEntries] = useState<Suppression[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    const data = await apiRequest<{ data: Suppression[] }>(`/cold-email/suppressions${params}`).catch(() => ({ data: [] }));
    setEntries(Array.isArray(data) ? data : (data as any)?.data ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [search]);

  const addSingle = async () => {
    if (!newEmail.trim()) return;
    await apiRequest('/cold-email/suppressions', { method: 'POST', body: JSON.stringify({ email: newEmail.trim() }) });
    setNewEmail(''); setMessage('Added'); void load();
  };

  const addBulk = async () => {
    const emails = bulkText.split('\n').map(e => e.trim()).filter(Boolean);
    if (emails.length === 0) return;
    const result = await apiRequest<{ created: number }>('/cold-email/suppressions/bulk', { method: 'POST', body: JSON.stringify({ emails }) });
    setBulkText(''); setMessage(`${result.created} added`); void load();
  };

  const remove = async (id: string) => {
    await apiRequest(`/cold-email/suppressions/${id}`, { method: 'DELETE' });
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold">Suppression List</h1><p className="text-sm text-muted-foreground mt-1">Manage emails that should never receive cold outreach</p></div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}><Plus className="h-4 w-4 mr-1.5" />Add</Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-2">
              <Input placeholder="email@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="flex-1" />
              <Button size="sm" onClick={() => void addSingle()}>Add Email</Button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bulk Import (one email per line)</Label>
              <textarea rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" placeholder={"bad@example.com\nnoreply@company.com"} value={bulkText} onChange={e => setBulkText(e.target.value)} />
              <Button size="sm" variant="outline" onClick={() => void addBulk()} disabled={!bulkText.trim()}><Upload className="h-3.5 w-3.5 mr-1.5" />Import {bulkText.split('\n').filter(l => l.trim()).length} emails</Button>
            </div>
            {message && <p className="text-xs text-emerald-600">{message}</p>}
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search suppressed emails..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card className="p-0">
        <CardContent className="p-0">
          {loading ? <p className="text-center text-sm text-muted-foreground py-12">Loading...</p> : entries.length === 0 ? (
            <div className="py-12 text-center"><Ban className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">No suppressed emails</p></div>
          ) : (
            <div className="divide-y divide-border">
              {entries.map(entry => (
                <div key={entry.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{entry.email}</span>
                    <Badge variant="secondary" className={`text-xs ${sourceColors[entry.source] ?? 'bg-gray-100'}`}>{entry.source}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleDateString()}</span>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => void remove(entry.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
