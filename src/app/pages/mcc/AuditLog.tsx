import { useEffect, useState } from 'react';
import { ScrollText, Search, Filter, Calendar, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationPrevious, PaginationNext, PaginationEllipsis,
} from '../../components/ui/pagination';

interface AuditEntry {
  id: string;
  actorUserId: string | null;
  tenantId: string | null;
  event: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface PaginatedResponse {
  items: AuditEntry[];
  pagination: { page: number; pageSize: number; total: number };
}

const EVENT_OPTIONS = [
  { value: 'all', label: 'All Events' },
  { value: 'tenant.created', label: 'tenant.created' },
  { value: 'tenant.updated', label: 'tenant.updated' },
  { value: 'tenant.deleted', label: 'tenant.deleted' },
  { value: 'tenant.integration.created', label: 'tenant.integration.created' },
  { value: 'tenant.integration.updated', label: 'tenant.integration.updated' },
  { value: 'tenant.integration.deleted', label: 'tenant.integration.deleted' },
  { value: 'tenant.access.invite_created', label: 'tenant.access.invite_created' },
  { value: 'tenant.access.owner_created', label: 'tenant.access.owner_created' },
  { value: 'tenant.access.password_reset', label: 'tenant.access.password_reset' },
  { value: 'team.invite.created', label: 'team.invite.created' },
  { value: 'team.member.role_changed', label: 'team.member.role_changed' },
  { value: 'team.member.removed', label: 'team.member.removed' },
  { value: 'impersonation.start', label: 'impersonation.start' },
  { value: 'impersonation.stop', label: 'impersonation.stop' },
];

function getEventBadgeClasses(event: string): string {
  if (event === 'tenant.created') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (event === 'tenant.updated') return 'bg-sky-100 text-sky-800 border-sky-200';
  if (event === 'tenant.deleted') return 'bg-red-100 text-red-800 border-red-200';
  if (event.startsWith('tenant.integration.')) return 'bg-violet-100 text-violet-800 border-violet-200';
  if (event.startsWith('tenant.access.')) return 'bg-amber-100 text-amber-800 border-amber-200';
  if (event.startsWith('team.')) return 'bg-indigo-100 text-indigo-800 border-indigo-200';
  if (event.startsWith('impersonation.')) return 'bg-rose-100 text-rose-800 border-rose-200';
  return 'bg-gray-100 text-gray-800 border-gray-200';
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString();
}

function MetadataCell({ metadata }: { metadata: Record<string, unknown> | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!metadata || Object.keys(metadata).length === 0) {
    return <span className="text-muted-foreground text-xs">--</span>;
  }

  const json = JSON.stringify(metadata, null, 2);
  const truncated = JSON.stringify(metadata);
  const isLong = truncated.length > 60;

  if (!isLong) {
    return (
      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono break-all">
        {truncated}
      </code>
    );
  }

  return (
    <div>
      {expanded ? (
        <div className="relative">
          <pre className="text-xs bg-muted p-2 rounded font-mono whitespace-pre-wrap break-all max-h-48 overflow-auto">
            {json}
          </pre>
          <button
            onClick={() => setExpanded(false)}
            className="text-xs text-primary hover:underline mt-1"
          >
            Collapse
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <code
            className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono truncate max-w-[200px] inline-block"
            title={json}
          >
            {truncated.slice(0, 60)}...
          </code>
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-primary hover:underline whitespace-nowrap"
          >
            Expand
          </button>
        </div>
      )}
    </div>
  );
}

function buildPaginationPages(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [1];

  if (current > 3) {
    pages.push('ellipsis');
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push('ellipsis');
  }

  pages.push(total);

  return pages;
}

export function AuditLog() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [eventFilter, setEventFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (eventFilter !== 'all') params.set('event', eventFilter);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      if (userSearch.trim()) params.set('userId', userSearch.trim());

      const result = await apiRequest<PaginatedResponse>(`/admin/audit-logs?${params.toString()}`);
      setData(result);
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, pageSize, eventFilter, fromDate, toDate, userSearch]);

  const totalPages = data ? Math.ceil(data.pagination.total / data.pagination.pageSize) : 0;
  const paginationPages = buildPaginationPages(page, totalPages);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ScrollText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
            <p className="text-sm text-muted-foreground">
              Track all admin actions across client accounts
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Filter className="h-3 w-3" />
                Event Type
              </label>
              <Select
                value={eventFilter}
                onValueChange={(val) => {
                  setEventFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Events" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                From
              </label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="w-[160px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                To
              </label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="w-[160px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Search className="h-3 w-3" />
                User ID
              </label>
              <Input
                type="text"
                placeholder="Search by user..."
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setPage(1);
                }}
                className="w-[200px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {data ? (
              <>
                {data.pagination.total} event{data.pagination.total !== 1 ? 's' : ''} found
              </>
            ) : (
              'Loading...'
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Timestamp</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Event</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actor</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tenant</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Details</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-muted-foreground">
                      Loading audit logs...
                    </td>
                  </tr>
                ) : data && data.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-muted-foreground">
                      No audit log entries found.
                    </td>
                  </tr>
                ) : (
                  data?.items.map((entry) => (
                    <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-muted-foreground">
                        {formatTimestamp(entry.createdAt)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={`font-mono text-xs ${getEventBadgeClasses(entry.event)}`}
                        >
                          {entry.event}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {entry.actorUserId ? (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                            {entry.actorUserId.slice(0, 8)}...
                          </code>
                        ) : (
                          <span className="text-xs text-muted-foreground">System</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {entry.tenantId ? (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                            {entry.tenantId.slice(0, 8)}...
                          </code>
                        ) : (
                          <span className="text-xs text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <MetadataCell metadata={entry.metadata as Record<string, unknown> | null} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={(e) => {
                        e.preventDefault();
                        if (page > 1) setPage(page - 1);
                      }}
                      className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      href="#"
                    />
                  </PaginationItem>

                  {paginationPages.map((p, i) =>
                    p === 'ellipsis' ? (
                      <PaginationItem key={`ellipsis-${i}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={p}>
                        <PaginationLink
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(p);
                          }}
                          isActive={page === p}
                          href="#"
                          className="cursor-pointer"
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}

                  <PaginationItem>
                    <PaginationNext
                      onClick={(e) => {
                        e.preventDefault();
                        if (page < totalPages) setPage(page + 1);
                      }}
                      className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      href="#"
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
