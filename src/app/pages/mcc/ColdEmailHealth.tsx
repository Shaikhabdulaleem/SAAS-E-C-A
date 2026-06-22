import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { HeartPulse, Shield, Mail, AlertTriangle, RefreshCw } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiRequest } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';

interface ColdEmailHealthData {
  metrics: {
    totalDomains: number;
    avgHealth: number;
    blacklisted: number;
    dnsCompliancePercent: number;
    totalMailboxes: number;
  };
  warmupCounts: {
    not_started: number;
    warming: number;
    ready: number;
    paused: number;
  };
  perTenant: Array<{
    tenantId: string;
    companyName: string;
    domains: number;
    avgHealth: number;
    mailboxes: number;
  }>;
}

interface RepliesSummary {
  totalReplies: number;
  categoryBreakdown: Record<string, number>;
  perTenant: Array<{
    tenantId: string;
    companyName: string;
    total: number;
    responded: number;
    responseRate: number;
    categories: Record<string, number>;
  }>;
}

const WARMUP_COLORS: Record<string, string> = {
  not_started: '#9ca3af',
  warming: '#0ea5e9',
  ready: '#10b981',
  paused: '#f59e0b',
};

const CATEGORY_COLORS = ['#4F46E5', '#7C3AED', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

export function ColdEmailHealth() {
  const [healthData, setHealthData] = useState<ColdEmailHealthData | null>(null);
  const [repliesData, setRepliesData] = useState<RepliesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [repliesLoading, setRepliesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiRequest<ColdEmailHealthData>('/admin/cold-email/health')
        .then((data) => setHealthData(data))
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load health data'))
        .finally(() => setLoading(false)),
      apiRequest<RepliesSummary>('/admin/cold-email/replies-summary')
        .then((data) => setRepliesData(data))
        .catch(() => {})
        .finally(() => setRepliesLoading(false)),
    ]);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const warmupPieData = healthData
    ? Object.entries(healthData.warmupCounts).map(([key, value]) => ({
        name: key.replace('_', ' '),
        value,
      }))
    : [];

  const categoryPieData = repliesData
    ? Object.entries(repliesData.categoryBreakdown).map(([key, value]) => ({
        name: key,
        value,
      }))
    : [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-50">
            <HeartPulse className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <h1 className="text-foreground">Cold Email Health</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Domain health, warmup status, and reply analytics across all tenants
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
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="domain-health">
        <TabsList>
          <TabsTrigger value="domain-health">Domain Health</TabsTrigger>
          <TabsTrigger value="reply-analytics">Reply Analytics</TabsTrigger>
        </TabsList>

        {/* Domain Health Tab */}
        <TabsContent value="domain-health" className="space-y-6 mt-4">
          {/* Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded-xl bg-indigo-50">
                    <Shield className="h-5 w-5 text-indigo-600" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-semibold text-foreground">
                    {loading ? '-' : healthData?.metrics.totalDomains ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Total Domains</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded-xl bg-emerald-50">
                    <HeartPulse className="h-5 w-5 text-emerald-600" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-semibold text-foreground">
                    {loading ? '-' : `${(healthData?.metrics.avgHealth ?? 0).toFixed(1)}%`}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Avg Health Score</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded-xl bg-red-50">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-semibold text-foreground">
                    {loading ? '-' : healthData?.metrics.blacklisted ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Blacklisted</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded-xl bg-sky-50">
                    <Mail className="h-5 w-5 text-sky-600" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-semibold text-foreground">
                    {loading ? '-' : `${(healthData?.metrics.dnsCompliancePercent ?? 0).toFixed(0)}%`}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">DNS Compliance</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Warmup Status Pie Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Warmup Status Distribution</CardTitle>
                <CardDescription>Current warmup state across all mailboxes</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-[250px] bg-muted rounded animate-pulse" />
                ) : (
                  <div style={{ height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={warmupPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {warmupPieData.map((entry) => (
                            <Cell
                              key={entry.name}
                              fill={WARMUP_COLORS[entry.name.replace(' ', '_')] ?? '#9ca3af'}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Warmup Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-[250px] bg-muted rounded animate-pulse" />
                ) : (
                  <div className="space-y-4 pt-4">
                    {warmupPieData.map((entry) => (
                      <div key={entry.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ background: WARMUP_COLORS[entry.name.replace(' ', '_')] ?? '#9ca3af' }}
                          />
                          <span className="text-sm capitalize">{entry.name}</span>
                        </div>
                        <span className="text-sm font-semibold">{entry.value}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total Mailboxes</span>
                        <span className="text-sm font-semibold">{healthData?.metrics.totalMailboxes ?? 0}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Per-Tenant Health Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Per-Tenant Domain Health</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-32 bg-muted rounded animate-pulse" />
              ) : healthData?.perTenant.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Company</th>
                        <th className="pb-2 font-medium text-right">Domains</th>
                        <th className="pb-2 font-medium text-right">Avg Health</th>
                        <th className="pb-2 font-medium text-right">Mailboxes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {healthData.perTenant.map((tenant) => (
                        <tr key={tenant.tenantId} className="hover:bg-muted/50">
                          <td className="py-2.5">
                            <Link
                              to={`/mcc/tenants/${tenant.tenantId}`}
                              className="font-medium text-foreground hover:text-primary hover:underline"
                            >
                              {tenant.companyName}
                            </Link>
                          </td>
                          <td className="py-2.5 text-right">{tenant.domains}</td>
                          <td className="py-2.5 text-right">
                            <Badge
                              variant={tenant.avgHealth >= 80 ? 'default' : tenant.avgHealth >= 50 ? 'secondary' : 'destructive'}
                              className="text-xs"
                            >
                              {tenant.avgHealth.toFixed(1)}%
                            </Badge>
                          </td>
                          <td className="py-2.5 text-right">{tenant.mailboxes}</td>
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
        </TabsContent>

        {/* Reply Analytics Tab */}
        <TabsContent value="reply-analytics" className="space-y-6 mt-4">
          {/* Total Replies Card */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded-xl bg-violet-50">
                    <Mail className="h-5 w-5 text-violet-600" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-semibold text-foreground">
                    {repliesLoading ? '-' : repliesData?.totalReplies ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Total Replies</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Category Breakdown Pie */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Reply Category Breakdown</CardTitle>
                <CardDescription>Distribution of reply types across all tenants</CardDescription>
              </CardHeader>
              <CardContent>
                {repliesLoading ? (
                  <div className="h-[250px] bg-muted rounded animate-pulse" />
                ) : categoryPieData.length > 0 ? (
                  <div style={{ height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {categoryPieData.map((_, index) => (
                            <Cell key={`cat-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-8 text-sm text-muted-foreground">No reply data available.</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Category Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {repliesLoading ? (
                  <div className="h-[250px] bg-muted rounded animate-pulse" />
                ) : categoryPieData.length > 0 ? (
                  <div className="space-y-3 pt-4">
                    {categoryPieData.map((entry, index) => (
                      <div key={entry.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ background: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                          />
                          <span className="text-sm capitalize">{entry.name}</span>
                        </div>
                        <span className="text-sm font-semibold">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-sm text-muted-foreground">No categories available.</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Per-Tenant Response Rate Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Per-Tenant Response Rates</CardTitle>
            </CardHeader>
            <CardContent>
              {repliesLoading ? (
                <div className="h-32 bg-muted rounded animate-pulse" />
              ) : repliesData?.perTenant.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Company</th>
                        <th className="pb-2 font-medium text-right">Total</th>
                        <th className="pb-2 font-medium text-right">Responded</th>
                        <th className="pb-2 font-medium text-right">Response Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {repliesData.perTenant.map((tenant) => (
                        <tr key={tenant.tenantId} className="hover:bg-muted/50">
                          <td className="py-2.5">
                            <Link
                              to={`/mcc/tenants/${tenant.tenantId}`}
                              className="font-medium text-foreground hover:text-primary hover:underline"
                            >
                              {tenant.companyName}
                            </Link>
                          </td>
                          <td className="py-2.5 text-right">{tenant.total}</td>
                          <td className="py-2.5 text-right">{tenant.responded}</td>
                          <td className="py-2.5 text-right">
                            <Badge
                              variant={tenant.responseRate >= 20 ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {tenant.responseRate.toFixed(1)}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">No reply data available.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
