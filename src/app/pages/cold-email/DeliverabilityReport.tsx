import { useState, useEffect } from 'react';
import { Shield, TrendingUp, AlertTriangle, CheckCircle, Mail, BarChart2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { apiRequest } from '../../lib/api';

interface DomainHealth { id: string; domain: string; healthScore: number; spfStatus: string; dkimStatus: string; dmarcStatus: string; mxStatus: string; blacklistStatus: string; }
interface CampaignStats { id: string; name: string; sentCount: number; openCount: number; replyCount: number; bounceCount: number; }

export function DeliverabilityReport() {
  const [domains, setDomains] = useState<DomainHealth[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiRequest<DomainHealth[]>('/provisioning/domain-health').catch(() => []),
      apiRequest<CampaignStats[]>('/cold-email/campaigns').catch(() => []),
    ]).then(([d, c]) => {
      setDomains(Array.isArray(d) ? d : []);
      setCampaigns(Array.isArray(c) ? c : []);
      setLoading(false);
    });
  }, []);

  const avgHealth = domains.length > 0 ? Math.round(domains.reduce((s, d) => s + d.healthScore, 0) / domains.length) : 0;
  const totalSent = campaigns.reduce((s, c) => s + (c.sentCount ?? 0), 0);
  const totalBounced = campaigns.reduce((s, c) => s + (c.bounceCount ?? 0), 0);
  const totalOpened = campaigns.reduce((s, c) => s + (c.openCount ?? 0), 0);
  const bounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;
  const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
  const healthyDomains = domains.filter(d => d.healthScore >= 80).length;
  const blacklisted = domains.filter(d => d.blacklistStatus !== 'clean').length;

  if (loading) return <div className="max-w-5xl mx-auto py-16 text-center"><p className="text-sm text-muted-foreground">Loading report...</p></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div><h1 className="text-xl font-semibold">Deliverability Report</h1><p className="text-sm text-muted-foreground mt-1">Unified view of your email sending reputation and health</p></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Avg Domain Health', value: `${avgHealth}%`, icon: Shield, color: avgHealth >= 80 ? 'text-emerald-600' : avgHealth >= 50 ? 'text-amber-600' : 'text-red-600', bg: avgHealth >= 80 ? 'bg-emerald-50' : avgHealth >= 50 ? 'bg-amber-50' : 'bg-red-50' },
          { label: 'Overall Open Rate', value: `${openRate.toFixed(1)}%`, icon: Mail, color: 'text-sky-600', bg: 'bg-sky-50' },
          { label: 'Bounce Rate', value: `${bounceRate.toFixed(1)}%`, icon: AlertTriangle, color: bounceRate > 5 ? 'text-red-600' : 'text-emerald-600', bg: bounceRate > 5 ? 'bg-red-50' : 'bg-emerald-50' },
          { label: 'Blacklisted', value: `${blacklisted}/${domains.length}`, icon: Shield, color: blacklisted > 0 ? 'text-red-600' : 'text-emerald-600', bg: blacklisted > 0 ? 'bg-red-50' : 'bg-emerald-50' },
        ].map(s => (
          <Card key={s.label} className="p-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${s.bg}`}><s.icon className={`h-4 w-4 ${s.color}`} /></div>
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-semibold">{s.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Domain Health Overview</CardTitle><CardDescription>{healthyDomains}/{domains.length} domains healthy</CardDescription></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {domains.map(d => (
              <div key={d.id} className="flex items-center gap-4 p-3 rounded-lg border">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{d.domain}</span>
                    <Badge variant="secondary" className={`text-xs ${d.healthScore >= 80 ? 'bg-emerald-50 text-emerald-700' : d.healthScore >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{d.healthScore}%</Badge>
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    <span>SPF {d.spfStatus === 'verified' ? '✅' : '❌'}</span>
                    <span>DKIM {d.dkimStatus === 'verified' ? '✅' : '❌'}</span>
                    <span>DMARC {d.dmarcStatus === 'verified' ? '✅' : '❌'}</span>
                    <span>MX {d.mxStatus === 'verified' ? '✅' : '❌'}</span>
                  </div>
                </div>
                <Progress value={d.healthScore} className="w-24" />
              </div>
            ))}
            {domains.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No domains configured</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Campaign Performance</CardTitle><CardDescription>Deliverability metrics across all campaigns</CardDescription></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Campaign</th><th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Sent</th><th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Opens</th><th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Open Rate</th><th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Bounces</th><th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Bounce Rate</th></tr></thead>
              <tbody>
                {campaigns.filter(c => c.sentCount > 0).map(c => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-right">{c.sentCount}</td>
                    <td className="px-4 py-3 text-right">{c.openCount}</td>
                    <td className="px-4 py-3 text-right text-sky-600">{c.sentCount > 0 ? ((c.openCount / c.sentCount) * 100).toFixed(1) : 0}%</td>
                    <td className="px-4 py-3 text-right">{c.bounceCount}</td>
                    <td className="px-4 py-3 text-right"><span className={c.sentCount > 0 && (c.bounceCount / c.sentCount) * 100 > 5 ? 'text-red-600 font-medium' : 'text-emerald-600'}>{c.sentCount > 0 ? ((c.bounceCount / c.sentCount) * 100).toFixed(1) : 0}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
