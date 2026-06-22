import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Zap, DollarSign, Hash, Users, RefreshCw, AlertCircle } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { apiRequest } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

interface AiUsageSummary {
  totals: {
    aiTokens: number;
    aiEvents: number;
    callInsightCost: number;
    callInsightTokens: number;
    callInsightCount: number;
  };
  perTenant: Array<{
    tenantId: string;
    companyName: string;
    totalTokens: number;
    eventCount: number;
  }>;
  perModel: Array<{ model: string; totalTokens: number; eventCount: number }>;
  dailyTrend: Array<{ date: string; tokens: number; count: number }>;
}

const MODEL_COLORS = ['#4F46E5', '#7C3AED', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];

export function AiCostMonitor() {
  const [data, setData] = useState<AiUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    apiRequest<AiUsageSummary>('/admin/ai/usage-summary')
      .then((res) => setData({
        totals: res?.totals ?? { aiTokens: 0, aiEvents: 0, callInsightCost: 0, callInsightTokens: 0, callInsightCount: 0 },
        perTenant: res?.perTenant ?? [],
        perModel: res?.perModel ?? [],
        dailyTrend: res?.dailyTrend ?? [],
      }))
      .catch((err) => {
        setData(null);
        setError(err instanceof Error ? err.message : 'Failed to load AI usage data');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalTokens = data?.totals.aiTokens ?? 0;
  const totalCost = data?.totals.callInsightCost ?? 0;
  const totalEvents = data?.totals.aiEvents ?? 0;
  const tenantCount = data?.perTenant.length ?? 1;

  const metrics = [
    {
      name: 'Total Tokens',
      value: data ? totalTokens.toLocaleString() : '-',
      icon: Hash,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      name: 'Total Cost',
      value: data ? `$${totalCost.toFixed(2)}` : '-',
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      name: 'AI Events',
      value: data ? totalEvents.toLocaleString() : '-',
      icon: Zap,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      name: 'Avg Tokens/Tenant',
      value: data ? Math.round(totalTokens / tenantCount).toLocaleString() : '-',
      icon: Users,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-50">
            <Zap className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-foreground">AI Usage Monitor</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Token consumption, costs, and model usage across all tenants
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

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((metric) => (
          <Card key={metric.name}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className={`p-2.5 rounded-xl ${metric.bg}`}>
                  <metric.icon className={`h-5 w-5 ${metric.color}`} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-semibold text-foreground">
                  {loading ? '-' : metric.value}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{metric.name}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily Usage Line Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Daily Token Usage</CardTitle>
            <CardDescription>Token consumption over time</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[250px] bg-muted rounded animate-pulse" />
            ) : data?.dailyTrend?.length ? (
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        name === 'cost' ? `$${value.toFixed(2)}` : value.toLocaleString(),
                        name === 'cost' ? 'Cost' : 'Tokens',
                      ]}
                    />
                    <Line type="monotone" dataKey="tokens" stroke="#4F46E5" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">No usage data available.</div>
            )}
          </CardContent>
        </Card>

        {/* Model Distribution Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Model Distribution</CardTitle>
            <CardDescription>Usage breakdown by model</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[250px] bg-muted rounded animate-pulse" />
            ) : data?.perModel?.length ? (
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.perModel}
                      dataKey="totalTokens"
                      nameKey="model"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ model, percent }) => `${model}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {data.perModel.map((_, index) => (
                        <Cell key={`model-${index}`} fill={MODEL_COLORS[index % MODEL_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Tokens']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">No model data available.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cost by Tenant Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cost by Tenant</CardTitle>
          <CardDescription>AI spend breakdown per client</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[300px] bg-muted rounded animate-pulse" />
          ) : data?.perTenant.length ? (
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.perTenant.slice(0, 15)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="companyName" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" angle={-30} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Tokens']} />
                  <Bar dataKey="totalTokens" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">No tenant data available.</div>
          )}
        </CardContent>
      </Card>

      {/* Per-Tenant Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Per-Tenant AI Usage</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-32 bg-muted rounded animate-pulse" />
          ) : data?.perTenant.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Company</th>
                    <th className="pb-2 font-medium text-right">Tokens</th>
                    <th className="pb-2 font-medium text-right">Events</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.perTenant.map((tenant) => (
                    <tr key={tenant.tenantId} className="hover:bg-muted/50">
                      <td className="py-2.5">
                        <Link
                          to={`/mcc/tenants/${tenant.tenantId}`}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {tenant.companyName}
                        </Link>
                      </td>
                      <td className="py-2.5 text-right">{tenant.totalTokens.toLocaleString()}</td>
                      <td className="py-2.5 text-right">{tenant.eventCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">No tenant data available.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
