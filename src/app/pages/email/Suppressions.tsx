import { useEffect, useState } from 'react';
import { Ban, Plus, Trash2 } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';

type SuppressionEntry = {
  id: string;
  email: string;
  source: 'manual' | 'unsubscribe' | 'bounce' | 'complaint' | 'import';
  reason?: string;
  createdAt: string;
};

export function Suppressions() {
  const [entries, setEntries] = useState<SuppressionEntry[]>([]);
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    apiRequest<SuppressionEntry[]>('/email/suppressions')
      .then(data => {
        setEntries(data);
        setError('');
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Unable to load suppressions'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const add = () => {
    if (!email.trim()) return;
    apiRequest<SuppressionEntry>('/email/suppressions', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), source: 'manual', reason: reason.trim() || undefined }),
    })
      .then(entry => {
        setEntries(prev => [entry, ...prev.filter(item => item.id !== entry.id)]);
        setEmail('');
        setReason('');
        setError('');
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Unable to add suppression'));
  };

  const remove = (id: string) => {
    apiRequest(`/email/suppressions/${id}`, { method: 'DELETE' })
      .then(() => setEntries(prev => prev.filter(item => item.id !== id)))
      .catch(err => setError(err instanceof Error ? err.message : 'Unable to remove suppression'));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>}

      <div>
        <h1 className="text-foreground">Suppression List</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Contacts here are blocked from marketing email sends.</p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="blocked@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Input value={reason} onChange={event => setReason(event.target.value)} placeholder="Manual block, complaint, etc." />
          </div>
          <Button onClick={add} disabled={!email.trim()}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Reason</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <tr key={entry.id} className="border-b border-border/70">
                    <td className="px-5 py-3 font-medium">{entry.email}</td>
                    <td className="px-5 py-3"><Badge variant="secondary" className="capitalize">{entry.source}</Badge></td>
                    <td className="px-5 py-3 text-muted-foreground">{entry.reason || '-'}</td>
                    <td className="px-5 py-3 text-muted-foreground">{new Date(entry.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-right">
                      <button className="inline-flex items-center gap-1 text-destructive hover:underline" onClick={() => remove(entry.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {!entries.length && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">
                      <Ban className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      {loading ? 'Loading suppressions...' : 'No suppressed emails yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
