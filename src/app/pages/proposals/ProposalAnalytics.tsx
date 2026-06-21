import { useEffect, useState } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

interface Analytics {
  total: number;
  accepted: number;
  rejected: number;
  winRate: number;
  totalRevenue: number;
  avgDealValue: number;
  byStatus: Record<string, number>;
  byService: Record<string, number>;
  byMonth: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#9ca3af',
  sent: '#3b82f6',
  viewed: '#f59e0b',
  accepted: '#10b981',
  rejected: '#ef4444',
  expired: '#6b7280',
};

const SERVICE_LABELS: Record<string, string> = {
  email_marketing: 'Email Marketing',
  cold_outreach: 'Cold Outreach',
  crm: 'CRM',
  ai_call_assistant: 'AI Call',
  advanced_analytics: 'Analytics',
};

export function ProposalAnalytics() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<Analytics>('/admin/proposals/analytics')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading analytics...</div>;
  if (!data) return <div className="py-12 text-center text-sm text-muted-foreground">Unable to load analytics</div>;

  const statusData = Object.entries(data.byStatus).map(([name, value]) => ({ name, value }));
  const serviceData = Object.entries(data.byService).map(([key, value]) => ({ name: SERVICE_LABELS[key] ?? key, value }));
  const monthData = Object.entries(data.byMonth).sort().map(([month, count]) => ({ month, count }));

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-primary/10"><BarChart3 className="h-4 w-4 text-primary" /></div>
        <h1 className="text-xl font-semibold">Proposal Analytics</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Proposals" value={data.total.toString()} />
        <StatCard label="Win Rate" value={`${data.winRate}%`} color="text-emerald-600" />
        <StatCard label="Avg Deal Value" value={`$${data.avgDealValue.toLocaleString()}`} />
        <StatCard label="Total Revenue Won" value={`$${data.totalRevenue.toLocaleString()}`} color="text-primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader><CardTitle className="text-base">Proposals by Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name} (${value})`}>
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#8884d8'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Revenue by Service</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={serviceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Proposals Over Time</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card className="p-0">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-semibold ${color ?? ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
