import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { SmilePlus, TrendingUp, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { apiRequest } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

interface NpsSummary {
  npsScore: number;
  total: number;
  promoters: number;
  passives: number;
  detractors: number;
  perTenant: Array<{
    tenantId: string;
    companyName: string;
    avgScore: number;
    latestScore: number;
    responses: number;
  }>;
}

const NPS_COLORS = ['#10b981', '#f59e0b', '#ef4444'];

export function NpsAnalytics() {
  const [data, setData] = useState<NpsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await apiRequest<NpsSummary>('/admin/nps/summary');
      setData(result);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { void fetchData(); }, []);

  const pieData = data ? [
    { name: 'Promoters', value: data.promoters },
    { name: 'Passives', value: data.passives },
    { name: 'Detractors', value: data.detractors },
  ] : [];

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <SmilePlus className="h-4 w-4 text-primary" />
            </div>
            <h1 className="text-foreground">NPS Analytics</h1>
          </div>
          <p className="text-sm text-muted-foreground">Net Promoter Score tracking across all clients</p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchData}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
        </Button>
      </div>

      {loading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Loading NPS data...</CardContent></Card>
      ) : !data || data.total === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No NPS surveys recorded yet</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Card className="p-0">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">NPS Score</p>
                <p className={`text-3xl font-bold ${data.npsScore >= 50 ? 'text-emerald-600' : data.npsScore >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                  {data.npsScore}
                </p>
              </CardContent>
            </Card>
            <Card className="p-0">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Total Responses</p>
                <p className="text-2xl font-semibold">{data.total}</p>
              </CardContent>
            </Card>
            <Card className="p-0">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-emerald-600">Promoters (9-10)</p>
                <p className="text-2xl font-semibold text-emerald-600">{data.promoters}</p>
              </CardContent>
            </Card>
            <Card className="p-0">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-amber-600">Passives (7-8)</p>
                <p className="text-2xl font-semibold text-amber-600">{data.passives}</p>
              </CardContent>
            </Card>
            <Card className="p-0">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-red-600">Detractors (0-6)</p>
                <p className="text-2xl font-semibold text-red-600">{data.detractors}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-0">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Distribution</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((_, i) => <Cell key={i} fill={NPS_COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="p-0 lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Per-Client NPS</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {data.perTenant.sort((a, b) => b.avgScore - a.avgScore).map(t => (
                    <div key={t.tenantId} className="flex items-center justify-between p-2 rounded-lg border border-border">
                      <Link to={`/mcc/tenants/${t.tenantId}`} className="text-sm font-medium hover:underline">{t.companyName}</Link>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{t.responses} responses</span>
                        <Badge variant={t.avgScore >= 9 ? 'default' : t.avgScore >= 7 ? 'secondary' : 'destructive'}>
                          {t.avgScore}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
