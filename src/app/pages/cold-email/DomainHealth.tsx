import { useState, useEffect } from 'react';
import { Globe, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Separator } from '../../components/ui/separator';
import { apiRequest } from '../../lib/api';

interface DomainMailbox {
  email: string;
  warmupStatus: 'not_started' | 'warming' | 'ready' | 'paused';
  healthScore: number;
  sentToday: number;
  dailyLimit: number;
  bounceRate: number;
  spamRate: number;
}

interface DomainHealthData {
  id: string;
  domain: string;
  healthScore: number;
  spfStatus: 'verified' | 'not_set' | 'error';
  dkimStatus: 'verified' | 'not_set' | 'error';
  dmarcStatus: 'verified' | 'not_set' | 'error';
  mxStatus: 'verified' | 'not_set' | 'error';
  blacklistStatus: 'clean' | 'listed';
  blacklistCheckedAt: string | null;
  customTrackingDomain: string | null;
  customTrackingActive: boolean;
  targetDailyVolume: number | null;
  requiredMailboxes: number | null;
  mailboxes: DomainMailbox[];
  totalMailboxes: number;
  activeMailboxes: number;
  readyMailboxes: number;
  warmingMailboxes: number;
  pausedMailboxes: number;
  todaysSent: number;
  totalDailyCapacity: number;
  sentToday: number;
  dailyLimit: number;
  lastCheckedAt: string | null;
}

const statusIcon = (status: string) => {
  if (status === 'verified') return <ShieldCheck className="h-4 w-4 text-emerald-600" />;
  if (status === 'error') return <ShieldAlert className="h-4 w-4 text-red-500" />;
  return <ShieldX className="h-4 w-4 text-muted-foreground" />;
};

const statusLabel = (status: string) => {
  if (status === 'verified') return 'Verified';
  if (status === 'error') return 'Error';
  return 'Not Set';
};

const statusBadgeClass = (status: string) => {
  if (status === 'verified') return 'bg-emerald-50 text-emerald-700';
  if (status === 'error') return 'bg-red-50 text-red-700';
  return 'bg-muted text-muted-foreground';
};

function healthScoreColor(score: number) {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function healthScoreBg(score: number) {
  if (score >= 80) return 'border-emerald-200 bg-emerald-50';
  if (score >= 50) return 'border-amber-200 bg-amber-50';
  return 'border-red-200 bg-red-50';
}

function healthBarClass(score: number) {
  if (score >= 80) return '[&>[data-slot=progress-indicator]]:bg-emerald-500';
  if (score >= 50) return '[&>[data-slot=progress-indicator]]:bg-amber-500';
  return '[&>[data-slot=progress-indicator]]:bg-red-500';
}

function reputationLabel(score: number) {
  if (score >= 80) return { label: 'High', className: 'bg-emerald-50 text-emerald-700' };
  if (score >= 50) return { label: 'Medium', className: 'bg-amber-50 text-amber-700' };
  return { label: 'Low', className: 'bg-red-50 text-red-700' };
}

const warmupBadgeConfig: Record<string, { label: string; className: string }> = {
  not_started: { label: 'Not Started', className: 'bg-muted text-muted-foreground' },
  warming: { label: 'Warming', className: 'bg-orange-50 text-orange-700' },
  ready: { label: 'Ready', className: 'bg-emerald-50 text-emerald-700' },
  paused: { label: 'Paused', className: 'bg-red-50 text-red-700' },
};

export function DomainHealth() {
  const [domains, setDomains] = useState<DomainHealthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const data = await apiRequest<DomainHealthData[]>('/provisioning/domain-health');
      setDomains(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCheck = async (domainId: string) => {
    setChecking(domainId);
    try {
      const updated = await apiRequest<DomainHealthData>(`/provisioning/domain-health/${domainId}/check`, { method: 'POST' });
      setDomains(prev => prev.map(d => d.id === domainId ? updated : d));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setChecking(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const totalDomains = domains.length;
  const healthyDomains = domains.filter(d => d.healthScore >= 80).length;
  const needsAttention = domains.filter(d => d.healthScore < 80).length;
  const blacklisted = domains.filter(d => d.blacklistStatus === 'listed').length;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-foreground">Domain Health</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Monitor sending reputation and DNS configuration across all domains</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Domains', value: totalDomains, icon: Globe, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Healthy', value: healthyDomains, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Needs Attention', value: needsAttention, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Blacklisted', value: blacklisted, icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(stat => (
          <Card key={stat.label} className="p-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-semibold text-foreground">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <Card><CardContent className="py-16 text-center"><p className="text-sm text-muted-foreground">Loading domain health...</p></CardContent></Card>
      ) : domains.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Globe className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No domains configured</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {domains.map(domain => {
            const rep = reputationLabel(domain.healthScore);
            const isExpanded = expanded[domain.id] || false;
            const sent = domain.todaysSent ?? domain.sentToday ?? 0;
            const limit = domain.totalDailyCapacity ?? domain.dailyLimit ?? 0;
            const sendProgress = limit > 0 ? Math.round((sent / limit) * 100) : 0;

            return (
              <Card key={domain.id} className="p-0">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`h-14 w-14 rounded-full border-2 flex items-center justify-center ${healthScoreBg(domain.healthScore)}`}>
                        <span className={`text-lg font-bold ${healthScoreColor(domain.healthScore)}`}>{domain.healthScore}</span>
                      </div>
                      <div>
                        <CardTitle className="text-base">{domain.domain}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className={`text-[10px] h-4 px-1.5 ${rep.className}`}>
                            {rep.label} Reputation
                          </Badge>
                          <Badge variant="secondary" className={`text-[10px] h-4 px-1.5 ${domain.blacklistStatus === 'clean' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            {domain.blacklistStatus === 'clean' ? 'Clean' : 'Blacklisted'}
                          </Badge>
                          {domain.customTrackingDomain && (
                            <Badge variant="secondary" className={`text-[10px] h-4 px-1.5 ${domain.customTrackingActive ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                              Tracking: {domain.customTrackingActive ? 'Active' : 'Inactive'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCheck(domain.id)}
                        disabled={checking === domain.id}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${checking === domain.id ? 'animate-spin' : ''}`} />
                        {checking === domain.id ? 'Checking...' : 'Check Health'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: 'SPF', status: domain.spfStatus },
                      { label: 'DKIM', status: domain.dkimStatus },
                      { label: 'DMARC', status: domain.dmarcStatus },
                      { label: 'MX', status: domain.mxStatus },
                    ].map(record => (
                      <div key={record.label} className={`rounded-lg border p-3 ${record.status === 'verified' ? 'border-emerald-200 bg-emerald-50/50' : record.status === 'error' ? 'border-red-200 bg-red-50/50' : 'border-border bg-muted/30'}`}>
                        <div className="flex items-center gap-2">
                          {statusIcon(record.status)}
                          <span className="text-sm font-medium text-foreground">{record.label}</span>
                        </div>
                        <Badge variant="secondary" className={`text-[10px] h-4 px-1.5 mt-1.5 ${statusBadgeClass(record.status)}`}>
                          {statusLabel(record.status)}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Mailbox Summary</p>
                      <p className="text-sm font-medium text-foreground">
                        {domain.totalMailboxes} mailboxes — {domain.activeMailboxes ?? domain.readyMailboxes} ready, {domain.warmingMailboxes} warming, {domain.pausedMailboxes} paused
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Today's sending</span>
                        <span className="font-medium text-foreground">{sent} / {limit} emails</span>
                      </div>
                      <Progress value={sendProgress} className={`h-1.5 ${healthBarClass(100 - sendProgress)}`} />
                    </div>
                  </div>

                  {domain.lastCheckedAt && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last checked {new Date(domain.lastCheckedAt).toLocaleString()}
                    </p>
                  )}

                  <button
                    onClick={() => toggleExpand(domain.id)}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {isExpanded ? 'Hide' : 'Show'} Mailbox Details ({domain.totalMailboxes})
                  </button>

                  {isExpanded && domain.mailboxes.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                            <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                            <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Health</th>
                            <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Sent Today</th>
                            <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Bounce</th>
                            <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Spam</th>
                          </tr>
                        </thead>
                        <tbody>
                          {domain.mailboxes.map(mb => {
                            const wbCfg = warmupBadgeConfig[mb.warmupStatus];
                            const mbSendPct = mb.dailyLimit > 0 ? Math.round((mb.sentToday / mb.dailyLimit) * 100) : 0;
                            return (
                              <tr key={mb.email} className={`border-b border-border last:border-0 ${mb.warmupStatus === 'paused' ? 'bg-red-50/50' : ''}`}>
                                <td className="py-2.5 px-3 font-medium text-foreground">{mb.email}</td>
                                <td className="py-2.5 px-3">
                                  <Badge variant="secondary" className={`text-[10px] h-4 px-1.5 ${wbCfg.className}`}>
                                    {wbCfg.label}
                                  </Badge>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-2">
                                    <Progress value={mb.healthScore} className={`h-1 w-16 ${healthBarClass(mb.healthScore)}`} />
                                    <span className={`text-xs font-medium ${healthScoreColor(mb.healthScore)}`}>{mb.healthScore}</span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-xs text-muted-foreground">{mb.sentToday}/{mb.dailyLimit}</td>
                                <td className="py-2.5 px-3">
                                  <span className={`text-xs ${mb.bounceRate > 5 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>{mb.bounceRate}%</span>
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className={`text-xs ${mb.spamRate > 1 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>{mb.spamRate}%</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
