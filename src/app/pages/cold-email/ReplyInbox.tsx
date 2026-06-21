import { useState, useEffect } from 'react';
import { MessageSquare, CheckCircle, XCircle, Clock, UserPlus, Tag, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { apiRequest } from '../../lib/api';

interface Reply { id: string; fromEmail: string; subject: string; body: string; category: string; assignedTo?: string; respondedAt?: string; campaignId?: string; receivedAt: string; }
interface ReplyStats { total: number; unhandled: number; interested: number; notInterested: number; }

const categoryConfig: Record<string, { label: string; color: string }> = {
  interested: { label: 'Interested', color: 'bg-emerald-50 text-emerald-700' },
  not_interested: { label: 'Not Interested', color: 'bg-red-50 text-red-700' },
  out_of_office: { label: 'Out of Office', color: 'bg-amber-50 text-amber-700' },
  wrong_person: { label: 'Wrong Person', color: 'bg-purple-50 text-purple-700' },
  uncategorized: { label: 'Uncategorized', color: 'bg-gray-100 text-gray-600' },
};

export function ReplyInbox() {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [stats, setStats] = useState<ReplyStats | null>(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const params = filter !== 'all' ? `?category=${filter}` : filter === 'unhandled' ? '?unhandled=true' : '';
    const [data, s] = await Promise.all([
      apiRequest<{ data: Reply[] }>(`/cold-email/replies${params}`).catch(() => ({ data: [] })),
      apiRequest<ReplyStats>('/cold-email/replies/stats').catch(() => null),
    ]);
    setReplies(Array.isArray(data) ? data : (data as any)?.data ?? []);
    setStats(s);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [filter]);

  const categorize = async (id: string, category: string) => {
    await apiRequest(`/cold-email/replies/${id}/categorize`, { method: 'PATCH', body: JSON.stringify({ category }) });
    setReplies(prev => prev.map(r => r.id === id ? { ...r, category } : r));
  };

  const markResponded = async (id: string) => {
    await apiRequest(`/cold-email/replies/${id}/responded`, { method: 'POST' });
    setReplies(prev => prev.map(r => r.id === id ? { ...r, respondedAt: new Date().toISOString() } : r));
  };

  const createDeal = async (id: string) => {
    await apiRequest(`/cold-email/replies/${id}/create-deal`, { method: 'POST' });
    setReplies(prev => prev.map(r => r.id === id ? { ...r, respondedAt: new Date().toISOString(), category: 'interested' } : r));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div><h1 className="text-xl font-semibold">Reply Inbox</h1><p className="text-sm text-muted-foreground mt-1">Manage all replies across your cold email campaigns</p></div>

      {stats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Replies', value: stats.total, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'Unhandled', value: stats.unhandled, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Interested', value: stats.interested, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Not Interested', value: stats.notInterested, color: 'text-red-600', bg: 'bg-red-50' },
          ].map(s => (
            <Card key={s.label} className="p-0"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-2xl font-semibold">{s.value}</p></CardContent></Card>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {['all', 'uncategorized', 'interested', 'not_interested', 'out_of_office'].map(f => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : categoryConfig[f]?.label ?? f}
          </Button>
        ))}
      </div>

      {loading ? <p className="text-center text-sm text-muted-foreground py-12">Loading...</p> : replies.length === 0 ? (
        <Card><CardContent className="py-16 text-center"><MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">No replies yet</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {replies.map(reply => (
            <Card key={reply.id} className={`p-0 ${!reply.respondedAt ? 'border-l-4 border-l-primary' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{reply.fromEmail}</span>
                      <Badge variant="secondary" className={`text-xs ${categoryConfig[reply.category]?.color ?? 'bg-gray-100'}`}>{categoryConfig[reply.category]?.label ?? reply.category}</Badge>
                      {!reply.respondedAt && <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700">Unhandled</Badge>}
                    </div>
                    {reply.subject && <p className="text-sm text-muted-foreground mt-1">{reply.subject}</p>}
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{reply.body}</p>
                    <p className="text-xs text-muted-foreground mt-2">{new Date(reply.receivedAt).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Select value={reply.category} onValueChange={(v) => void categorize(reply.id, v)}>
                      <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoryConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {!reply.respondedAt && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void markResponded(reply.id)}><CheckCircle className="h-3 w-3 mr-1" />Handled</Button>}
                    {reply.category === 'interested' && !reply.respondedAt && <Button size="sm" className="h-7 text-xs" onClick={() => void createDeal(reply.id)}><UserPlus className="h-3 w-3 mr-1" />Create Deal</Button>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
