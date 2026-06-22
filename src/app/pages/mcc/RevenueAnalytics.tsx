import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { DollarSign, TrendingUp, Percent, PieChart as PieChartIcon, RefreshCw } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiRequest } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

interface RevenueData {
  metrics: {
    totalMrr: number;
    netRevenueRetention: number;
    avgRevenuePerAccount: number;
    integrationCostRatio: number;
  };
  mrrHistory: Array<{ month: string; mrr: number }>;
  planBreakdown: Array<{ plan: string; label: string; mrr: number; count: number; color: string }>;
  topClients: Array<{ id: string; companyName: string; mrr: number; integrationCost: number; profit: number }>;
}

const PIE_COLORS = ['#0ea5e9', '#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export function RevenueAnalytics() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    void apiRequest<RevenueData>('/admin/dashboard/revenue')
      .then((res) => setData(res))
      .catch((err) => {
        setData(null);
        setError(err instanceof Error ? err.message : 'Unable to load revenue data');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const metricCards = data
    ? [
        {
          name: 'Total MRR',
          value: `$${data.metrics.totalMrr.toLocaleString()}`,
          icon: DollarSign,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
        },
        {
          name: 'Net Revenue Retention',
          value: `${data.metrics.netRevenueRetention.toFixed(1)}%`,
          icon: TrendingUp,
          color: 'text-indigo-600',
          bg: 'bg-indigo-50',
        },
        {
          name: 'Avg Revenue/Account',
          value: `$${Math.round(data.metrics.avgRevenuePerAccount).toLocaleString()}`,
          icon: Percent,
          color: 'text-violet-600',
          bg: 'bg-violet-50',
        },
        {
          name: 'Integration Cost Ratio',
          value: `${data.metrics.integrationCostRatio.toFixed(1)}%`,
          icon: PieChartIcon,
          color: 'text-sky-600',
          bg: 'bg-sky-50',
        },
      ]
    : [];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-foreground">Revenue Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Loading revenue data...</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="h-4 w-20 bg-muted rounded animate-pulse mb-3" />
                <div className="h-8 w-24 bg-muted rounded animate-pulse mb-2" />
                <div className="h-3 w-16 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2].map((i) => (
            <Card key={i} className={i === 1 ? 'lg:col-span-2' : ''}>
              <CardContent className="p-5">
                <div className="h-[280px] bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
        <div className="text-center">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto">
        <Card>
          <CardContent className="py-14 text-center">
            <DollarSign className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <h1 className="text-foreground">Revenue Analytics</h1>
            <p className="text-sm text-muted-foreground mt-2">No revenue data available yet.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50">
            <DollarSign className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-foreground">Revenue Analytics</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Track MRR, retention, and profitability across all clients</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metricCards.map((metric) => (
          <Card key={metric.name} className="relative overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className={`p-2.5 rounded-xl ${metric.bg}`}>
                  <metric.icon className={`h-5 w-5 ${metric.color}`} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-semibold text-foreground">{metric.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{metric.name}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* MRR Growth */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">MRR Growth</CardTitle>
            <CardDescription>Monthly recurring revenue over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.mrrHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'MRR']} />
                  <Line type="monotone" dataKey="mrr" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Plan Revenue */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Plan Revenue</CardTitle>
            <CardDescription>MRR by plan type</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.planBreakdown}
                    dataKey="mrr"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ label, mrr }) => `${label}: $${mrr.toLocaleString()}`}
                  >
                    {data.planBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'MRR']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Clients Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top 10 Clients by Revenue</CardTitle>
          <CardDescription>Revenue, costs, and profitability breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          {data.topClients.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Client</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">MRR</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Integration Cost</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Profit</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topClients.slice(0, 10).map((client) => {
                    const margin = client.mrr > 0 ? ((client.profit / client.mrr) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={client.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2.5 px-3">
                          <Link
                            to={`/mcc/tenants/${client.id}`}
                            className="font-medium text-foreground hover:text-primary"
                          >
                            {client.companyName}
                          </Link>
                        </td>
                        <td className="text-right py-2.5 px-3 text-foreground">${client.mrr.toLocaleString()}</td>
                        <td className="text-right py-2.5 px-3 text-muted-foreground">${client.integrationCost.toLocaleString()}</td>
                        <td className="text-right py-2.5 px-3 font-medium text-emerald-600">${client.profit.toLocaleString()}</td>
                        <td className="text-right py-2.5 px-3 text-muted-foreground">{margin}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="min-h-20 flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
              No client revenue data available.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
