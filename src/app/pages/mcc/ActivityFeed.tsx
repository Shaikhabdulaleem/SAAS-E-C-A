import { useEffect, useState, useCallback } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from '../../components/ui/pagination';

interface AuditItem {
  id: string;
  actorUserId: string | null;
  tenantId: string | null;
  event: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  type?: string;
}

interface LoginEvent {
  id: string;
  type: string;
  actorUserId: string;
  actorName: string;
  tenantId: string | null;
  tenantName: string | null;
  event: string;
  metadata: null;
  createdAt: string;
}

interface ActivityFeedResponse {
  items: AuditItem[];
  loginEvents: LoginEvent[];
  pagination: { page: number; pageSize: number; total: number };
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  tenant_created: 'bg-emerald-100 text-emerald-800',
  tenant_updated: 'bg-sky-100 text-sky-800',
  user_login: 'bg-indigo-100 text-indigo-800',
  user_invite: 'bg-violet-100 text-violet-800',
  campaign_sent: 'bg-amber-100 text-amber-800',
  domain_added: 'bg-teal-100 text-teal-800',
  subscription_changed: 'bg-pink-100 text-pink-800',
  payment_failed: 'bg-red-100 text-red-800',
  default: 'bg-gray-100 text-gray-800',
};

const EVENT_TYPES = [
  { value: 'all', label: 'All Events' },
  { value: 'tenant_created', label: 'Tenant Created' },
  { value: 'tenant_updated', label: 'Tenant Updated' },
  { value: 'user_login', label: 'User Login' },
  { value: 'user_invite', label: 'User Invite' },
  { value: 'campaign_sent', label: 'Campaign Sent' },
  { value: 'domain_added', label: 'Domain Added' },
  { value: 'subscription_changed', label: 'Subscription Changed' },
  { value: 'payment_failed', label: 'Payment Failed' },
];

export function ActivityFeed() {
  const [data, setData] = useState<ActivityFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [tenantFilter, setTenantFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: page.toString() });
    if (tenantFilter.trim()) params.set('tenantId', tenantFilter.trim());
    if (typeFilter !== 'all') params.set('type', typeFilter);

    apiRequest<ActivityFeedResponse>(`/admin/activity-feed?${params.toString()}`)
      .then((res) => setData({
        items: res?.items ?? [],
        loginEvents: res?.loginEvents ?? [],
        pagination: res?.pagination ?? { page: 1, pageSize: 25, total: 0 },
      }))
      .catch((err) => {
        setData(null);
        setError(err instanceof Error ? err.message : 'Failed to load activity feed');
      })
      .finally(() => setLoading(false));
  }, [page, tenantFilter, typeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50">
            <Activity className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-foreground">Activity Feed</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Timeline of events across all tenants
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Filter by Tenant ID..."
                value={tenantFilter}
                onChange={(e) => setTenantFilter(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={typeFilter} onValueChange={(val) => { setTypeFilter(val); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Event Type" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="secondary" onClick={handleSearch}>
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3 text-sm text-destructive">
            <Activity className="h-4 w-4 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* Event Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Events {data ? `(${data.pagination.total} total)` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-4 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-muted mt-2 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 bg-muted rounded" />
                    <div className="h-3 w-64 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : data?.items?.length ? (
            <div className="space-y-1">
              {data.items.map((event) => (
                <div
                  key={event.id}
                  className="flex gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col items-center pt-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                    <div className="w-px flex-1 bg-border mt-1" />
                  </div>
                  <div className="flex-1 min-w-0 pb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        className={`text-[10px] ${EVENT_TYPE_COLORS[event.event] ?? EVENT_TYPE_COLORS.default}`}
                      >
                        {event.event.replace(/\./g, ' ')}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-foreground mt-1">{event.metadata ? JSON.stringify(event.metadata) : event.event}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      {event.actorUserId && <span>Actor: {event.actorUserId.slice(0, 8)}</span>}
                      {event.tenantId && <span>Tenant: {event.tenantId.slice(0, 8)}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">No events found.</div>
          )}
        </CardContent>
      </Card>

      {/* Recent Logins */}
      {data?.loginEvents && data.loginEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Logins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">User</th>
                    <th className="pb-2 font-medium">Tenant</th>
                    <th className="pb-2 font-medium">IP Address</th>
                    <th className="pb-2 font-medium text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.loginEvents.map((login) => (
                    <tr key={login.id} className="hover:bg-muted/50">
                      <td className="py-2.5 font-medium">{login.actorName}</td>
                      <td className="py-2.5 text-muted-foreground">{login.tenantName ?? '—'}</td>
                      <td className="py-2.5 text-muted-foreground font-mono text-xs">{login.actorUserId?.slice(0, 8)}</td>
                      <td className="py-2.5 text-right text-muted-foreground">
                        {new Date(login.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {data && Math.ceil((data.pagination?.total ?? 0) / (data.pagination?.pageSize ?? 25)) > 1 && (
        <div className="flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              {Array.from({ length: Math.min(Math.ceil((data.pagination?.total ?? 0) / (data.pagination?.pageSize ?? 25)), 7) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => setPage(pageNum)}
                      isActive={page === pageNum}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage((p) => Math.min(Math.ceil((data.pagination?.total ?? 0) / (data.pagination?.pageSize ?? 25)), p + 1))}
                  className={page >= Math.ceil((data.pagination?.total ?? 0) / (data.pagination?.pageSize ?? 25)) ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
