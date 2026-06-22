import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { TrendingUp, Users, Building2, Mail, DollarSign, Activity, Target, Zap, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiRequest } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useTenants } from '../contexts/TenantContext';
import type { ServiceKey } from '../contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Separator } from '../components/ui/separator';

const MCC_PIE_COLORS = ['#0ea5e9', '#6366f1', '#8b5cf6', '#10b981'];

interface MccDashboard {
  metrics: {
    totalMrr: number;
    arr: number;
    activeCount: number;
    trialCount: number;
    onboardingCount: number;
    paymentFailedCount: number;
    suspendedCount: number;
    cancelledCount: number;
    totalCount: number;
    churnRate: number;
    avgMrrPerClient: number;
  };
  planDistribution: Array<{ plan: string; count: number; mrr: number }>;
  topClients: Array<{ id: string; companyName: string; plan: string; mrr: number; status: string }>;
  expiringTrials: Array<{ id: string; companyName: string; email: string; trialEndsAt: string; daysRemaining: number }>;
  recentSignups: Array<{ id: string; companyName: string; plan: string; createdAt: string }>;
  mrrHistory: Array<{ month: string; mrr: number }>;
}

const STAGE_COLORS = ['#4F46E5', '#7C3AED', '#2563EB', '#0891B2', '#059669', '#E11D48'];
const STATUS_COLORS: Record<string, string> = {
  customer: '#4F46E5',
  prospect: '#7C3AED',
  lead: '#0891B2',
  churned: '#E11D48',
};

interface DashboardSummary {
  contacts: number;
  companies: number;
  openDeals: number;
  pipelineValue: number;
  avgDealValue: number;
  campaigns: number;
  activities: number;
  openRate: number;
  clickRate: number;
}

interface WeeklyActivity {
  date: string;
  day: string;
  calls: number;
  emails: number;
  deals: number;
}

interface ContactStatus {
  status: string;
  label: string;
  value: number;
}

interface PipelineStage {
  stage: string;
  label: string;
  count: number;
  value: number;
}

interface CampaignPerformance {
  id: string;
  name: string;
  label: string;
  openRate: number;
  clickRate: number;
}

interface RecentActivity {
  id: string;
  type: string;
  subject: string;
  createdBy: string;
  createdAt: string;
}

interface DashboardOverview {
  summary: DashboardSummary;
  weeklyActivity: WeeklyActivity[];
  contactStatus: ContactStatus[];
  pipeline: PipelineStage[];
  campaignPerformance: CampaignPerformance[];
  recentActivities: RecentActivity[];
}

export function Dashboard() {
  const { user } = useAuth();
  const { selectedTenantId, selectedTenant } = useTenants();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mccData, setMccData] = useState<MccDashboard | null>(null);
  const [mccLoading, setMccLoading] = useState(true);
  const [mccError, setMccError] = useState<string | null>(null);
  const [mccRefresh, setMccRefresh] = useState(0);
  const [churnRiskData, setChurnRiskData] = useState<Array<{ tenantId: string; companyName: string; riskScore: number; riskFactors: string[] }> | null>(null);

  const isSuperAdmin = user?.role === 'superadmin';

  useEffect(() => {
    if (!user) return;
    if (isSuperAdmin && !selectedTenantId) {
      setOverview(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    void apiRequest<DashboardOverview>('/dashboard/overview')
      .then((data) => setOverview(data))
      .catch((err) => {
        setOverview(null);
        setError(err instanceof Error ? err.message : 'Unable to load dashboard data');
      })
      .finally(() => setLoading(false));
  }, [user?.id, user?.role, selectedTenantId]);

  useEffect(() => {
    if (!isSuperAdmin || selectedTenantId) return;
    setMccLoading(true);
    setMccError(null);
    void Promise.all([
      apiRequest<MccDashboard>('/admin/dashboard')
        .then((data) => setMccData(data))
        .catch((err) => {
          setMccData(null);
          setMccError(err instanceof Error ? err.message : 'Unable to load MCC dashboard');
        }),
      apiRequest<Array<{ tenantId: string; companyName: string; riskScore: number; riskFactors: string[] }>>('/admin/dashboard/churn-risk')
        .then((data) => setChurnRiskData(data))
        .catch(() => setChurnRiskData(null)),
    ]).finally(() => setMccLoading(false));
  }, [isSuperAdmin, selectedTenantId, mccRefresh]);

  const fetchMccData = () => setMccRefresh((n) => n + 1);

  const summary = overview?.summary;
  const services = isSuperAdmin ? (selectedTenant?.enabledServices ?? []) : (user?.enabledServices ?? []);
  const canUse = (service: ServiceKey) => services.includes(service);

  if (isSuperAdmin && !selectedTenantId) {

    const mccMetrics = [
      {
        name: 'Total MRR',
        value: mccData ? `$${mccData.metrics.totalMrr.toLocaleString()}` : '-',
        subtext: mccData ? `Annual: $${mccData.metrics.arr.toLocaleString()}` : '',
        icon: DollarSign,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
      },
      {
        name: 'Active Clients',
        value: mccData ? mccData.metrics.activeCount.toString() : '-',
        subtext: mccData ? `${mccData.metrics.totalCount} total` : '',
        icon: Building2,
        color: 'text-indigo-600',
        bg: 'bg-indigo-50',
      },
      {
        name: 'On Trial',
        value: mccData ? mccData.metrics.trialCount.toString() : '-',
        subtext: 'Converting soon',
        icon: Clock,
        color: 'text-sky-600',
        bg: 'bg-sky-50',
      },
      {
        name: 'Avg MRR/Client',
        value: mccData ? `$${Math.round(mccData.metrics.avgMrrPerClient).toLocaleString()}` : '-',
        subtext: 'Per active account',
        icon: TrendingUp,
        color: 'text-violet-600',
        bg: 'bg-violet-50',
      },
    ];

    if (mccLoading) {
      return (
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-foreground">MCC Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Loading dashboard data...</p>
            </div>
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
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="h-[250px] bg-muted rounded animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      );
    }

    if (mccError) {
      return (
        <div className="max-w-5xl mx-auto space-y-4">
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {mccError}
            </CardContent>
          </Card>
          <div className="text-center">
            <Button variant="outline" onClick={fetchMccData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      );
    }

    if (!mccData) {
      return (
        <div className="max-w-5xl mx-auto">
          <Card>
            <CardContent className="py-14 text-center">
              <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <h1 className="text-foreground">MCC Admin Workspace</h1>
              <p className="text-sm text-muted-foreground mt-2">No dashboard data available.</p>
              <Link
                to="/mcc/tenants"
                className="inline-flex items-center gap-2 mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Open Client Management
              </Link>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground">MCC Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Multi-client command center overview</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchMccData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Row 1: Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {mccMetrics.map((metric) => (
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
                  <div className="text-xs text-muted-foreground/70 mt-0.5">{metric.subtext}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Row 2: Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* MRR Trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">MRR Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mccData.mrrHistory}>
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

          {/* Plan Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Plan Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mccData.planDistribution}
                      dataKey="count"
                      nameKey="plan"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ plan, count }) => `${plan}: ${count}`}
                    >
                      {mccData.planDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={MCC_PIE_COLORS[index % MCC_PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Revenue by Plan */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Revenue by Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mccData.planDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="plan" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'MRR']} />
                    <Bar dataKey="mrr" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Row 3: Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Top Clients by MRR */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top Clients by MRR</CardTitle>
            </CardHeader>
            <CardContent>
              {mccData.topClients.length > 0 ? (
                <div className="space-y-3">
                  {mccData.topClients.map((client) => (
                    <div key={client.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Link
                          to={`/mcc/tenants/${client.id}`}
                          className="text-sm font-medium text-foreground hover:text-primary truncate"
                        >
                          {client.companyName}
                        </Link>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{client.plan}</Badge>
                      </div>
                      <span className="text-sm font-medium text-foreground shrink-0 ml-2">
                        ${client.mrr.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPanel text="No client data available." />
              )}
            </CardContent>
          </Card>

          {/* Expiring Trials */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Expiring Trials</CardTitle>
            </CardHeader>
            <CardContent>
              {mccData.expiringTrials.length > 0 ? (
                <div className="space-y-3">
                  {mccData.expiringTrials.map((trial) => (
                    <div key={trial.id} className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{trial.companyName}</p>
                        <p className="text-xs text-muted-foreground truncate">{trial.email}</p>
                      </div>
                      <Badge
                        variant={trial.daysRemaining <= 3 ? 'destructive' : 'secondary'}
                        className="text-[10px] shrink-0 ml-2"
                      >
                        {trial.daysRemaining}d left
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPanel text="No expiring trials." />
              )}
            </CardContent>
          </Card>

          {/* Recent Signups */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent Signups</CardTitle>
            </CardHeader>
            <CardContent>
              {mccData.recentSignups.length > 0 ? (
                <div className="space-y-3">
                  {mccData.recentSignups.map((signup) => (
                    <div key={signup.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-foreground truncate">{signup.companyName}</span>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{signup.plan}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {new Date(signup.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPanel text="No recent signups." />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 4: At Risk Clients */}
        {churnRiskData && churnRiskData.length > 0 && (
          <Card className="p-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-red-700">At Risk Clients</CardTitle>
              <CardDescription>Clients showing signs of churn</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {churnRiskData.slice(0, 5).map((client) => (
                  <div key={client.tenantId} className="flex items-center justify-between p-3 rounded-lg border border-red-100 bg-red-50/50">
                    <div>
                      <Link to={`/mcc/tenants/${client.tenantId}`} className="text-sm font-medium hover:underline">{client.companyName}</Link>
                      <div className="flex gap-1 mt-1">
                        {client.riskFactors.map((f, i) => <Badge key={i} variant="destructive" className="text-[10px]">{f}</Badge>)}
                      </div>
                    </div>
                    <span className="text-lg font-bold text-red-700">{client.riskScore}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const stats = [
    {
      name: 'Total Pipeline',
      value: formatCompactCurrency(summary?.pipelineValue ?? 0),
      subtext: `${summary?.openDeals ?? 0} active deals`,
      icon: DollarSign,
      trend: `${Math.round(summary?.avgDealValue ?? 0).toLocaleString()} avg`,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      name: 'Active Contacts',
      value: (summary?.contacts ?? 0).toString(),
      subtext: 'Tenant contacts',
      icon: Users,
      trend: `${summary?.activities ?? 0} activities`,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      name: 'Companies',
      value: (summary?.companies ?? 0).toString(),
      subtext: 'Tracked accounts',
      icon: Building2,
      trend: `${summary?.openDeals ?? 0} open deals`,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
    },
    {
      name: 'Email Open Rate',
      value: `${(summary?.openRate ?? 0).toFixed(1)}%`,
      subtext: `${(summary?.clickRate ?? 0).toFixed(1)}% click rate`,
      icon: Mail,
      trend: `${summary?.campaigns ?? 0} sent`,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
  ];

  const pipelineTotal = overview?.pipeline.reduce((sum, stage) => sum + stage.value, 0) ?? 0;
  const contactTotal = overview?.contactStatus.reduce((sum, status) => sum + status.value, 0) ?? 0;
  const quickActions = [
    canUse('crm') && { to: '/contacts', icon: Users, label: 'Add Contact', sub: 'Create new contact', color: 'text-indigo-600 bg-indigo-50' },
    canUse('crm') && { to: '/companies', icon: Building2, label: 'Add Company', sub: 'New account', color: 'text-violet-600 bg-violet-50' },
    canUse('crm') && { to: '/deals', icon: TrendingUp, label: 'Create Deal', sub: 'New opportunity', color: 'text-sky-600 bg-sky-50' },
    canUse('email_marketing') && { to: '/campaigns', icon: Mail, label: 'New Campaign', sub: 'Email campaign', color: 'text-emerald-600 bg-emerald-50' },
  ].filter(Boolean) as Array<{ to: string; icon: typeof Users; label: string; sub: string; color: string }>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-foreground">Welcome back, {user?.name?.split(' ')[0] ?? 'there'}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canUse('ai_assistant') && (
            <Link to="/ai-assistant" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-border rounded-md bg-background hover:bg-muted transition-colors">
              <Zap className="h-3.5 w-3.5" />
              AI Assistant
            </Link>
          )}
          {canUse('crm') && (
            <Link to="/deals" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
              <Target className="h-3.5 w-3.5" />
              View Pipeline
            </Link>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name} className="relative overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <Badge variant="secondary" className="text-xs text-muted-foreground bg-muted">
                  {loading ? 'Loading' : stat.trend}
                </Badge>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-semibold text-foreground">{loading ? '-' : stat.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{stat.name}</div>
                <div className="text-xs text-muted-foreground/70 mt-0.5">{stat.subtext}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Weekly Activity</CardTitle>
            <CardDescription>Calls and emails from backend activity records</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <EmptyPanel text="Loading activity..." />
            ) : overview?.weeklyActivity.some((day) => day.calls > 0 || day.emails > 0) ? (
              <div className="grid grid-cols-2 gap-6">
                {(['calls', 'emails'] as const).map((key) => {
                  const color = key === 'calls' ? '#4F46E5' : '#7C3AED';
                  const max = Math.max(...overview.weeklyActivity.map((day) => day[key]), 1);
                  return (
                    <div key={key}>
                      <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5 capitalize">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                        {key}
                      </p>
                      <div className="flex items-end gap-1 h-20">
                        {overview.weeklyActivity.map((day) => (
                          <div key={`${key}-${day.date}`} className="flex-1 flex flex-col items-center gap-1">
                            <div
                              className="w-full rounded-t-sm transition-all"
                              style={{ height: `${(day[key] / max) * 64}px`, background: color, opacity: 0.8 }}
                            />
                            <span className="text-[9px] text-muted-foreground">{day.day}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyPanel text="No call or email activity has been logged this week." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Contact Status</CardTitle>
            <CardDescription>Distribution by backend status</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <EmptyPanel text="Loading contacts..." />
            ) : overview?.contactStatus.length ? (
              <div className="space-y-4">
                {overview.contactStatus.map((status) => {
                  const pct = contactTotal > 0 ? Math.round((status.value / contactTotal) * 100) : 0;
                  const color = STATUS_COLORS[status.status] ?? '#64748B';
                  return (
                    <div key={status.status}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                          {status.label}
                        </span>
                        <span className="text-xs font-medium text-foreground">{status.value} <span className="text-muted-foreground/60">({pct}%)</span></span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyPanel text="No contacts are available for this tenant." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Pipeline by Stage</CardTitle>
                <CardDescription>Total value: {formatCurrency(pipelineTotal)}</CardDescription>
              </div>
              {canUse('crm') && <Link to="/deals" className="text-xs text-muted-foreground hover:text-foreground transition-colors">View all</Link>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <EmptyPanel text="Loading pipeline..." />
            ) : overview?.pipeline.length ? (
              overview.pipeline.map((stage, index) => {
                const color = STAGE_COLORS[index % STAGE_COLORS.length];
                return (
                  <div key={stage.stage}>
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                        <span className="text-sm font-medium text-foreground">{stage.label}</span>
                        <Badge variant="secondary" className="text-xs h-4 px-1.5">{stage.count}</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatCurrency(stage.value)}</span>
                    </div>
                    <Progress
                      value={pipelineTotal > 0 ? (stage.value / pipelineTotal) * 100 : 0}
                      className="h-1.5"
                      style={{ '--progress-foreground': color } as CSSProperties}
                    />
                  </div>
                );
              })
            ) : (
              <EmptyPanel text="No open deals are available for this tenant." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <EmptyPanel text="Loading activity..." />
            ) : overview?.recentActivities.length ? (
              overview.recentActivities.slice(0, 4).map((activity, index) => (
                <div key={activity.id}>
                  <div className="flex gap-3 items-start">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-semibold text-primary">{activityLabel(activity.type)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground leading-snug">{activity.subject}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(activity.createdAt).toLocaleDateString()} - {activity.createdBy}
                      </p>
                    </div>
                  </div>
                  {index < Math.min(overview.recentActivities.length, 4) - 1 && <Separator className="mt-3" />}
                </div>
              ))
            ) : (
              <EmptyPanel text="No recent activity has been logged." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Email Campaign Performance</CardTitle>
          <CardDescription>Open rate and click rate from backend campaign metrics</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <EmptyPanel text="Loading campaigns..." />
          ) : overview?.campaignPerformance.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {([
                { key: 'openRate' as const, label: 'Open Rate', color: '#4F46E5' },
                { key: 'clickRate' as const, label: 'Click Rate', color: '#7C3AED' },
              ]).map(({ key, label, color }) => {
                const max = Math.max(...overview.campaignPerformance.map((campaign) => campaign[key]), 1);
                const latest = overview.campaignPerformance[overview.campaignPerformance.length - 1][key];
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                        {label}
                      </p>
                      <span className="text-sm font-semibold" style={{ color }}>{latest.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-end gap-1 h-16">
                      {overview.campaignPerformance.map((campaign) => (
                        <div key={`${key}-${campaign.id}`} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full rounded-t-sm"
                            style={{ height: `${(campaign[key] / max) * 48}px`, background: color, opacity: 0.75 }}
                          />
                          <span className="text-[9px] text-muted-foreground truncate max-w-full">{campaign.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyPanel text="No campaign performance data is available." />
          )}
        </CardContent>
      </Card>

      {quickActions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all group"
                >
                  <div className={`p-2 rounded-lg ${action.color}`}>
                    <action.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.sub}</p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="min-h-20 flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatCompactCurrency(value: number) {
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return formatCurrency(value);
}

function activityLabel(type: string) {
  if (type === 'call') return 'CALL';
  if (type.includes('email')) return 'MAIL';
  if (type === 'meeting') return 'MEET';
  return 'LOG';
}
