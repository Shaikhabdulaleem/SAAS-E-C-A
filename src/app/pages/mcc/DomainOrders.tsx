import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Globe, RefreshCw, AlertCircle, Package, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

interface DomainOrder {
  id: string;
  tenantId: string;
  baseName: string;
  quantity: number;
  status: string;
  totalCost: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  tenant: { id: string; companyName: string };
}

interface DomainOrdersResponse {
  orders: DomainOrder[];
  pipeline: Record<string, number>;
  pagination: { page: number; pageSize: number; total: number };
  perTenant: Array<{ tenantId: string; companyName: string; orderCount: number; totalCost: number; successRate: number }>;
  failedOrders: Array<{ id: string; tenantId: string; companyName: string; baseName: string; lastError: string; createdAt: string }>;
}

const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
  generating: { color: 'bg-blue-100 text-blue-800', icon: Loader2 },
  checking: { color: 'bg-sky-100 text-sky-800', icon: Clock },
  purchasing: { color: 'bg-amber-100 text-amber-800', icon: Package },
  completed: { color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
  failed: { color: 'bg-red-100 text-red-800', icon: XCircle },
  pending: { color: 'bg-gray-100 text-gray-800', icon: Clock },
  dns_setup: { color: 'bg-violet-100 text-violet-800', icon: Globe },
  provisioning: { color: 'bg-indigo-100 text-indigo-800', icon: Loader2 },
};

const STATUS_CARD_COLORS: Record<string, { bg: string; text: string; iconColor: string }> = {
  generating: { bg: 'bg-blue-50', text: 'text-blue-600', iconColor: 'text-blue-600' },
  checking: { bg: 'bg-sky-50', text: 'text-sky-600', iconColor: 'text-sky-600' },
  purchasing: { bg: 'bg-amber-50', text: 'text-amber-600', iconColor: 'text-amber-600' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-600', iconColor: 'text-emerald-600' },
  failed: { bg: 'bg-red-50', text: 'text-red-600', iconColor: 'text-red-600' },
  pending: { bg: 'bg-gray-50', text: 'text-gray-600', iconColor: 'text-gray-600' },
  dns_setup: { bg: 'bg-violet-50', text: 'text-violet-600', iconColor: 'text-violet-600' },
  provisioning: { bg: 'bg-indigo-50', text: 'text-indigo-600', iconColor: 'text-indigo-600' },
};

export function DomainOrders() {
  const [data, setData] = useState<DomainOrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = () => {
    setLoading(true);
    setError(null);
    apiRequest<DomainOrdersResponse>('/admin/domain-purchases')
      .then((res) => setData({
        orders: res?.orders ?? [],
        pipeline: res?.pipeline ?? {},
        pagination: res?.pagination ?? { page: 1, pageSize: 25, total: 0 },
        perTenant: res?.perTenant ?? [],
        failedOrders: res?.failedOrders ?? [],
      }))
      .catch((err) => {
        setData(null);
        setError(err instanceof Error ? err.message : 'Failed to load domain orders');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredOrders = data?.orders.filter((order) => {
    const matchesSearch = !searchFilter.trim() ||
      order.tenant?.companyName ?? order.baseName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      order.id.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) ?? [];

  const statusEntries = data ? Object.entries(data.pipeline) : [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-50">
            <Globe className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-foreground">Domain Orders</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Domain purchase pipeline status across all tenants
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* Pipeline Status Cards */}
      {statusEntries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {statusEntries.map(([status, count]) => {
            const cfg = STATUS_CARD_COLORS[status] ?? { bg: 'bg-gray-50', text: 'text-gray-600', iconColor: 'text-gray-600' };
            const StatusIcon = STATUS_CONFIG[status]?.icon ?? Package;
            return (
              <Card key={status} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className={`p-2 rounded-lg ${cfg.bg}`}>
                      <StatusIcon className={`h-4 w-4 ${cfg.iconColor}`} />
                    </div>
                    {statusFilter === status && (
                      <Badge variant="default" className="text-[10px]">Active</Badge>
                    )}
                  </div>
                  <div className="mt-2">
                    <div className={`text-xl font-semibold ${cfg.text}`}>{count}</div>
                    <div className="text-xs text-muted-foreground capitalize mt-0.5">
                      {status.replace(/_/g, ' ')}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search by company or order ID..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statusEntries.map(([status]) => (
                    <SelectItem key={status} value={status}>
                      {status.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Domain Orders ({filteredOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : filteredOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Company</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium text-right">Domains</th>
                    <th className="pb-2 font-medium text-right">Cost</th>
                    <th className="pb-2 font-medium text-right">Created</th>
                    <th className="pb-2 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredOrders.map((order) => {
                    const isFailed = order.status === 'failed';
                    return (
                      <tr
                        key={order.id}
                        className={`hover:bg-muted/50 ${isFailed ? 'bg-red-50/50' : ''}`}
                      >
                        <td className="py-2.5">
                          <Link
                            to={`/mcc/tenants/${order.tenantId}`}
                            className="font-medium text-foreground hover:text-primary hover:underline"
                          >
                            {order.tenant?.companyName ?? order.baseName}
                          </Link>
                        </td>
                        <td className="py-2.5">
                          <Badge className={`text-[10px] ${STATUS_CONFIG[order.status]?.color ?? 'bg-gray-100 text-gray-800'}`}>
                            {order.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-right">{order.quantity}</td>
                        <td className="py-2.5 text-right">${order.totalCost.toFixed(2)}</td>
                        <td className="py-2.5 text-right text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5">
                          {order.lastError ? (
                            <span className="text-xs text-red-600 max-w-[200px] truncate block">
                              {order.lastError}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No domain orders found.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
