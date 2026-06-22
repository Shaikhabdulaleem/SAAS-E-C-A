import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Phone, Clock, FileText, Mic, RefreshCw, AlertCircle } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { apiRequest } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

interface CallSummary {
  totalCalls: number;
  avgDuration: number;
  summarizationRate: number;
  totalRecordingHours: number;
  coachingScoreDistribution: Array<{ range: string; count: number }>;
  sentimentBreakdown: Array<{ sentiment: string; count: number }>;
  perTenant: Array<{
    tenantId: string;
    companyName: string;
    sessions: number;
    avgDuration: number;
    avgCoachingScore: number;
    sentiment: string;
  }>;
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#10b981',
  neutral: '#6366f1',
  negative: '#ef4444',
  mixed: '#f59e0b',
};

const COACHING_COLORS = ['#ef4444', '#f59e0b', '#eab308', '#84cc16', '#10b981'];

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function CallAnalytics() {
  const [data, setData] = useState<CallSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    apiRequest<CallSummary>('/admin/calls/summary')
      .then((res) => setData(res))
      .catch((err) => {
        setData(null);
        setError(err instanceof Error ? err.message : 'Failed to load call analytics');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const metrics = [
    {
      name: 'Total Calls',
      value: data ? data.totalCalls.toLocaleString() : '-',
      icon: Phone,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      name: 'Avg Duration',
      value: data ? formatDuration(data.avgDuration) : '-',
      icon: Clock,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
    },
    {
      name: 'Summarization Rate',
      value: data ? `${data.summarizationRate.toFixed(1)}%` : '-',
      icon: FileText,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      name: 'Recording Hours',
      value: data ? data.totalRecordingHours.toFixed(1) : '-',
      icon: Mic,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50">
            <Phone className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-foreground">Call Analytics</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Call sessions, coaching scores, and sentiment analysis across tenants
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Coaching Score Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Coaching Score Distribution</CardTitle>
            <CardDescription>Score ranges across all call sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[250px] bg-muted rounded animate-pulse" />
            ) : data?.coachingScoreDistribution.length ? (
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.coachingScoreDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {data.coachingScoreDistribution.map((_, index) => (
                        <Cell key={`coaching-${index}`} fill={COACHING_COLORS[index % COACHING_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">No coaching data available.</div>
            )}
          </CardContent>
        </Card>

        {/* Sentiment Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sentiment Breakdown</CardTitle>
            <CardDescription>Call sentiment analysis results</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[250px] bg-muted rounded animate-pulse" />
            ) : data?.sentimentBreakdown.length ? (
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.sentimentBreakdown}
                      dataKey="count"
                      nameKey="sentiment"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ sentiment, count }) => `${sentiment}: ${count}`}
                    >
                      {data.sentimentBreakdown.map((entry) => (
                        <Cell
                          key={entry.sentiment}
                          fill={SENTIMENT_COLORS[entry.sentiment] ?? '#9ca3af'}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">No sentiment data available.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-Tenant Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Per-Tenant Call Summary</CardTitle>
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
                    <th className="pb-2 font-medium text-right">Sessions</th>
                    <th className="pb-2 font-medium text-right">Avg Duration</th>
                    <th className="pb-2 font-medium text-right">Avg Coaching Score</th>
                    <th className="pb-2 font-medium">Sentiment</th>
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
                      <td className="py-2.5 text-right">{tenant.sessions}</td>
                      <td className="py-2.5 text-right">{formatDuration(tenant.avgDuration)}</td>
                      <td className="py-2.5 text-right">
                        <Badge
                          variant={tenant.avgCoachingScore >= 70 ? 'default' : tenant.avgCoachingScore >= 40 ? 'secondary' : 'destructive'}
                          className="text-xs"
                        >
                          {tenant.avgCoachingScore.toFixed(1)}
                        </Badge>
                      </td>
                      <td className="py-2.5">
                        <Badge
                          className="text-[10px]"
                          style={{
                            backgroundColor: `${SENTIMENT_COLORS[tenant.sentiment] ?? '#9ca3af'}20`,
                            color: SENTIMENT_COLORS[tenant.sentiment] ?? '#9ca3af',
                          }}
                        >
                          {tenant.sentiment}
                        </Badge>
                      </td>
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
