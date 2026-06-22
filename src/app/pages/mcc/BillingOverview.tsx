import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { CreditCard, AlertCircle, Calendar, RefreshCw, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

interface BillingOverviewData {
  subscriptions: Array<{
    id: string;
    tenantId: string;
    companyName: string;
    plan: string;
    mrr: number;
    tenantStatus: string;
    subscriptionStatus: string;
    seats: number;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    createdAt: string;
  }>;
  failedPayments: Array<{ id: string; tenantId: string; companyName: string; status: string; plan: string }>;
  upcomingRenewals: Array<{ id: string; tenantId: string; companyName: string; currentPeriodEnd: string; plan: string }>;
  totalActive: number;
  totalFailed: number;
  totalUpcoming: number;
}

const statusColors: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  trialing: 'bg-sky-50 text-sky-700 border-sky-200',
  past_due: 'bg-red-50 text-red-700 border-red-200',
  canceled: 'bg-gray-50 text-gray-700 border-gray-200',
  unpaid: 'bg-orange-50 text-orange-700 border-orange-200',
};

export function BillingOverview() {
  const [data, setData] = useState<BillingOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await apiRequest<BillingOverviewData>('/admin/billing/overview');
      setData(result);
    } catch {
      // handle error silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const filteredSubscriptions = (data?.subscriptions ?? []).filter(
    s => statusFilter === 'all' || s.subscriptionStatus === statusFilter
  );

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <h1 className="text-foreground">Billing Overview</h1>
          </div>
          <p className="text-sm text-muted-foreground">Subscription status and payment tracking across all clients</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void fetchData()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-0">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 shrink-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Active</p>
              <p className="text-xl font-semibold text-foreground">{data?.totalActive ?? 0}</p>
              <p className="text-[10px] text-muted-foreground/70">Active subscriptions</p>
            </div>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-50 shrink-0">
              <AlertCircle className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Failed Payments</p>
              <p className="text-xl font-semibold text-foreground">{data?.totalFailed ?? 0}</p>
              <p className="text-[10px] text-muted-foreground/70">Require attention</p>
            </div>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 shrink-0">
              <Calendar className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Upcoming Renewals</p>
              <p className="text-xl font-semibold text-foreground">{data?.totalUpcoming ?? 0}</p>
              <p className="text-[10px] text-muted-foreground/70">Next 30 days</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Failed Payments + Upcoming Renewals Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Failed Payments */}
        <Card className="p-0 border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Failed Payments
            </CardTitle>
            <CardDescription className="text-xs">Clients with payment issues</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {data?.failedPayments.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">No failed payments</p>
            )}
            <div className="space-y-2">
              {data?.failedPayments.map(fp => (
                <div key={fp.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <Link
                      to={`/mcc/tenants/${fp.tenantId}`}
                      className="text-sm font-medium text-foreground hover:text-primary hover:underline transition-colors"
                    >
                      {fp.companyName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{fp.plan}</p>
                  </div>
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                    {fp.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Renewals */}
        <Card className="p-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-500" />
              Upcoming Renewals
            </CardTitle>
            <CardDescription className="text-xs">Subscriptions renewing soon</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {data?.upcomingRenewals.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">No upcoming renewals</p>
            )}
            <div className="space-y-2">
              {data?.upcomingRenewals.map(ur => (
                <div key={ur.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <Link
                      to={`/mcc/tenants/${ur.tenantId}`}
                      className="text-sm font-medium text-foreground hover:text-primary hover:underline transition-colors"
                    >
                      {ur.companyName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{ur.plan}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(ur.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Table */}
      <Card className="overflow-hidden p-0">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-sm">All Subscriptions</CardTitle>
              <CardDescription className="text-xs">Full subscription list across all tenants</CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="past_due">Past Due</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
                <SelectItem value="trialing">Trialing</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Company</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Plan</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">MRR</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Seats</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Period End</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground hidden xl:table-cell">Cancel at End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredSubscriptions.map(sub => (
                <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <Link
                      to={`/mcc/tenants/${sub.tenantId}`}
                      className="text-sm font-medium text-foreground hover:text-primary hover:underline transition-colors"
                    >
                      {sub.companyName}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant="outline" className="text-xs capitalize">{sub.plan}</Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center text-xs px-2 py-1 rounded-full border ${statusColors[sub.subscriptionStatus] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                      {sub.subscriptionStatus}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    <span className="text-sm font-medium text-emerald-600">
                      {sub.mrr > 0 ? `$${sub.mrr.toLocaleString()}` : <span className="text-muted-foreground/50">---</span>}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell text-sm text-muted-foreground">
                    {sub.seats}
                  </td>
                  <td className="px-5 py-3.5 hidden lg:table-cell text-xs text-muted-foreground">
                    {sub.currentPeriodEnd
                      ? new Date(sub.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '---'}
                  </td>
                  <td className="px-5 py-3.5 hidden xl:table-cell">
                    {sub.cancelAtPeriodEnd ? (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">Yes</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredSubscriptions.length === 0 && !loading && (
            <div className="text-center py-16 text-muted-foreground">
              <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No subscriptions found</p>
            </div>
          )}
          {loading && (
            <div className="text-center py-16 text-muted-foreground">
              <RefreshCw className="h-6 w-6 mx-auto mb-3 animate-spin opacity-50" />
              <p className="text-sm">Loading billing data...</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
