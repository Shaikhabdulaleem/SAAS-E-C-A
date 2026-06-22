import { useEffect, useState } from 'react';
import { BarChart3, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Label } from '../../components/ui/label';

interface PlanBenchmark {
  plan: string;
  count: number;
  avgMrr: number;
  avgServices: number;
  avgSeats: number;
}

interface TenantRanking {
  tenantId: string;
  companyName: string;
  plan: string;
  mrr: number;
  services: number;
  seats: number;
  mrrPercentile: number;
}

interface TenantComparison {
  tenantId: string;
  companyName: string;
  plan: string;
  status: string;
  mrr: number;
  seats: number;
  servicesEnabled: number;
  integrations: number;
  contacts: number;
  deals: number;
  campaigns: number;
  members: number;
}

interface BenchmarkData {
  planAverages: PlanBenchmark[];
  tenantRankings: TenantRanking[];
}

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  starter: { bg: 'bg-gray-50', text: 'text-gray-700' },
  growth: { bg: 'bg-sky-50', text: 'text-sky-700' },
  professional: { bg: 'bg-indigo-50', text: 'text-indigo-700' },
  enterprise: { bg: 'bg-violet-50', text: 'text-violet-700' },
};

function getColor(plan: string) {
  return PLAN_COLORS[plan.toLowerCase()] ?? { bg: 'bg-gray-50', text: 'text-gray-700' };
}

export function TenantBenchmark() {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Comparison
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<TenantComparison[] | null>(null);
  const [comparing, setComparing] = useState(false);

  const fetchBenchmarks = () => {
    setLoading(true);
    setError(null);
    apiRequest<BenchmarkData>('/admin/benchmarks')
      .then((res) => setData({
        planAverages: res?.planAverages ?? [],
        tenantRankings: res?.tenantRankings ?? [],
      }))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load benchmarks'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBenchmarks();
  }, []);

  const handleCompare = async () => {
    if (selectedIds.length < 2) return;
    setComparing(true);
    setComparison(null);
    try {
      const ids = selectedIds.join(',');
      const result = await apiRequest<TenantComparison[]>(`/admin/benchmarks/compare?ids=${ids}`);
      setComparison(result);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      setComparing(false);
    }
  };

  const addTenant = (id: string) => {
    if (selectedIds.length >= 3 || selectedIds.includes(id)) return;
    setSelectedIds((prev) => [...prev, id]);
    setComparison(null);
  };

  const removeTenant = (id: string) => {
    setSelectedIds((prev) => prev.filter((i) => i !== id));
    setComparison(null);
  };

  const isHighlighted = (tenant: TenantComparison, key: keyof TenantComparison, higher = true) => {
    if (!comparison || comparison.length < 2) return false;
    const val = Number(tenant[key]);
    const vals = comparison.map((t) => Number(t[key]));
    const best = higher ? Math.max(...vals) : Math.min(...vals);
    return val === best && vals.filter((v) => v === best).length === 1;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tenant Benchmarks</h1>
            <p className="text-sm text-muted-foreground">
              Compare tenant metrics and view plan-level averages
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchBenchmarks} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
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

      {/* Plan Averages */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Plan-Tier Averages</h2>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="h-28 bg-muted rounded animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : data?.planAverages && data.planAverages.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.planAverages.map((plan) => {
              const color = getColor(plan.plan);
              return (
                <Card key={plan.plan}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <Badge className={`${color.bg} ${color.text} capitalize`}>
                        {plan.plan}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{plan.count} tenants</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Avg MRR</span>
                        <span className="font-semibold">${plan.avgMrr.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Avg Services</span>
                        <span className="font-semibold">{plan.avgServices.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Avg Seats</span>
                        <span className="font-semibold">{plan.avgSeats.toFixed(1)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No benchmark data available.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tenant Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tenant Comparison</CardTitle>
          <CardDescription>
            Select 2-3 tenants to compare side by side
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4 mb-4">
            <div className="space-y-2 flex-1 max-w-xs">
              <Label>Add Tenant</Label>
              <Select
                value=""
                onValueChange={(val) => addTenant(val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a tenant to add" />
                </SelectTrigger>
                <SelectContent>
                  {(data?.tenantRankings ?? [])
                    .filter((t) => !selectedIds.includes(t.tenantId))
                    .map((t) => (
                      <SelectItem key={t.tenantId} value={t.tenantId}>{t.companyName}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleCompare}
              disabled={selectedIds.length < 2 || comparing}
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              {comparing ? 'Comparing...' : 'Compare'}
            </Button>
          </div>

          {/* Selected Tenants */}
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedIds.map((id) => {
                const tenant = data?.tenantRankings.find((t) => t.tenantId === id);
                return (
                  <Badge key={id} variant="secondary" className="text-sm py-1 px-3">
                    {tenant?.companyName ?? id}
                    <button
                      className="ml-2 text-muted-foreground hover:text-foreground"
                      onClick={() => removeTenant(id)}
                    >
                      x
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Comparison Results */}
          {comparison && comparison.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {comparison.map((tenant) => (
                <Card key={tenant.tenantId} className="border-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{tenant.companyName}</CardTitle>
                    <Badge variant="secondary" className="w-fit capitalize text-xs">
                      {tenant.plan}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {([
                      { key: 'mrr' as const, label: 'MRR', format: (v: number) => `$${v.toLocaleString()}`, higher: true },
                      { key: 'servicesEnabled' as const, label: 'Services', format: (v: number) => String(v), higher: true },
                      { key: 'seats' as const, label: 'Seats', format: (v: number) => String(v), higher: true },
                      { key: 'contacts' as const, label: 'Contacts', format: (v: number) => String(v), higher: true },
                      { key: 'deals' as const, label: 'Deals', format: (v: number) => String(v), higher: true },
                      { key: 'campaigns' as const, label: 'Campaigns', format: (v: number) => String(v), higher: true },
                      { key: 'members' as const, label: 'Members', format: (v: number) => String(v), higher: true },
                    ]).map((metric) => {
                      const highlighted = isHighlighted(tenant, metric.key, metric.higher);
                      return (
                        <div
                          key={metric.key}
                          className={`flex justify-between items-center text-sm py-1.5 px-2 rounded ${
                            highlighted ? 'bg-emerald-50' : ''
                          }`}
                        >
                          <span className="text-muted-foreground">{metric.label}</span>
                          <span className={`font-semibold ${highlighted ? 'text-emerald-700' : ''}`}>
                            {metric.format(Number(tenant[metric.key]) || 0)}
                          </span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
