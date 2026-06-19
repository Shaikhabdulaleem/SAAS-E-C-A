import { useState, useEffect } from 'react';
import { Flame, Users, CheckCircle, Clock, AlertTriangle, Activity, FastForward, Pause } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Separator } from '../../components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { apiRequest } from '../../lib/api';

interface WarmupPersona {
  id: string;
  fullName: string;
  email: string;
  domain: string;
  warmupStatus: 'not_started' | 'warming' | 'ready' | 'paused';
  warmupDay: number;
  warmupTotal: number;
  dailyLimit: number;
  sentToday: number;
  healthScore: number;
  bounceRate: number;
  spamRate: number;
}

const warmupSchedule = [
  { week: 'Week 1', limit: 5, color: 'bg-orange-200' },
  { week: 'Week 2', limit: 10, color: 'bg-orange-300' },
  { week: 'Week 3', limit: 20, color: 'bg-orange-400' },
  { week: 'Week 4', limit: 35, color: 'bg-amber-500' },
  { week: 'Week 5+', limit: 50, color: 'bg-emerald-500' },
];

const warmupBadgeConfig: Record<string, { label: string; className: string; icon?: React.ElementType }> = {
  not_started: { label: 'Not Started', className: 'bg-muted text-muted-foreground' },
  warming: { label: 'Warming', className: 'bg-orange-50 text-orange-700', icon: Flame },
  ready: { label: 'Ready', className: 'bg-emerald-50 text-emerald-700', icon: CheckCircle },
  paused: { label: 'Paused', className: 'bg-amber-50 text-amber-700', icon: Pause },
};

function healthScoreColor(score: number) {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function healthBarClass(score: number) {
  if (score >= 80) return '[&>[data-slot=progress-indicator]]:bg-emerald-500';
  if (score >= 50) return '[&>[data-slot=progress-indicator]]:bg-amber-500';
  return '[&>[data-slot=progress-indicator]]:bg-red-500';
}

export function WarmupDashboard() {
  const [personas, setPersonas] = useState<WarmupPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [advancing, setAdvancing] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const data = await apiRequest<WarmupPersona[]>('/provisioning/warmup');
      setPersonas(data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleAdvance = async (personaId: string) => {
    setAdvancing(personaId);
    try {
      const updated = await apiRequest<WarmupPersona>(`/provisioning/warmup/${personaId}/advance`, { method: 'POST' });
      setPersonas(prev => prev.map(p => p.id === personaId ? updated : p));
    } catch {
    } finally {
      setAdvancing(null);
    }
  };

  const filtered = personas.filter(p => {
    if (filter === 'warming') return p.warmupStatus === 'warming';
    if (filter === 'ready') return p.warmupStatus === 'ready';
    if (filter === 'not_started') return p.warmupStatus === 'not_started';
    if (filter === 'paused') return p.warmupStatus === 'paused';
    return true;
  });

  const totalPersonas = personas.length;
  const warmingCount = personas.filter(p => p.warmupStatus === 'warming').length;
  const readyCount = personas.filter(p => p.warmupStatus === 'ready').length;
  const notStartedCount = personas.filter(p => p.warmupStatus === 'not_started').length;
  const avgHealthScore = totalPersonas > 0 ? Math.round(personas.reduce((sum, p) => sum + p.healthScore, 0) / totalPersonas) : 0;
  const hasLowHealth = personas.some(p => p.healthScore < 80 && p.warmupStatus !== 'not_started');

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-foreground">Warmup Progress</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Monitor mailbox warmup status across all personas</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total Personas', value: totalPersonas, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Warming Up', value: warmingCount, icon: Flame, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Ready to Send', value: readyCount, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Not Started', value: notStartedCount, icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted' },
          { label: 'Avg Health Score', value: avgHealthScore, icon: Activity, color: 'text-sky-600', bg: 'bg-sky-50' },
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

      {hasLowHealth && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900">Health Score Warning</p>
              <p className="text-xs text-amber-700 mt-0.5">
                One or more personas have a health score below 80. Monitor their bounce and spam rates closely to avoid deliverability issues.
              </p>
            </div>
          </div>
        </div>
      )}

      <Card className="p-0">
        <CardHeader>
          <CardTitle className="text-base">Warmup Schedule Reference</CardTitle>
          <CardDescription>Daily sending limits ramp up over the warmup period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-32">
            {warmupSchedule.map(ws => {
              const heightPct = (ws.limit / 50) * 100;
              return (
                <div key={ws.week} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-semibold text-foreground">{ws.limit}/day</span>
                  <div className="w-full flex items-end" style={{ height: '80px' }}>
                    <div className={`w-full rounded-t-md ${ws.color}`} style={{ height: `${heightPct}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{ws.week}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="warming">Warming</TabsTrigger>
          <TabsTrigger value="ready">Ready</TabsTrigger>
          <TabsTrigger value="not_started">Not Started</TabsTrigger>
          <TabsTrigger value="paused">Paused</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <Card><CardContent className="py-16 text-center"><p className="text-sm text-muted-foreground">Loading warmup data...</p></CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Flame className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No personas found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(persona => {
            const wCfg = warmupBadgeConfig[persona.warmupStatus];
            const dayProgress = persona.warmupTotal > 0 ? Math.round((persona.warmupDay / persona.warmupTotal) * 100) : 0;
            const sendProgress = persona.dailyLimit > 0 ? Math.round((persona.sentToday / persona.dailyLimit) * 100) : 0;

            return (
              <Card key={persona.id} className="p-0">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{persona.fullName}</h3>
                      <p className="text-xs text-muted-foreground">{persona.email}</p>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 mt-1 bg-indigo-50 text-indigo-700">
                        {persona.domain}
                      </Badge>
                    </div>
                    <Badge variant="secondary" className={`text-xs h-5 ${wCfg.className} gap-1`}>
                      {wCfg.icon && <wCfg.icon className="h-3 w-3" />}
                      {wCfg.label}
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Warmup Progress</span>
                      <span className="font-medium text-foreground">Day {persona.warmupDay} of {persona.warmupTotal}</span>
                    </div>
                    <Progress value={dayProgress} className="h-1.5 [&>[data-slot=progress-indicator]]:bg-orange-500" />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Current Daily Limit</span>
                    <span className="font-medium text-foreground">{persona.dailyLimit} emails/day</span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Health Score</span>
                      <span className={`font-semibold ${healthScoreColor(persona.healthScore)}`}>{persona.healthScore}%</span>
                    </div>
                    <Progress value={persona.healthScore} className={`h-1.5 ${healthBarClass(persona.healthScore)}`} />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground">Sent Today</p>
                        <p className="text-xs font-semibold text-foreground">{persona.sentToday}/{persona.dailyLimit}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground">Bounce Rate</p>
                        <p className={`text-xs font-semibold ${persona.bounceRate > 5 ? 'text-red-600' : 'text-foreground'}`}>{persona.bounceRate}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground">Spam Rate</p>
                        <p className={`text-xs font-semibold ${persona.spamRate > 1 ? 'text-red-600' : 'text-foreground'}`}>{persona.spamRate}%</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAdvance(persona.id)}
                      disabled={advancing === persona.id || persona.warmupStatus === 'ready'}
                    >
                      <FastForward className={`h-3.5 w-3.5 mr-1.5 ${advancing === persona.id ? 'animate-pulse' : ''}`} />
                      {advancing === persona.id ? 'Advancing...' : 'Advance Day'}
                    </Button>
                  </div>

                  {persona.healthScore >= 80 && persona.warmupStatus === 'ready' && (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Ready to send
                    </div>
                  )}

                  {persona.healthScore < 80 && persona.warmupStatus === 'warming' && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 font-medium flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Still warming — monitor health score closely
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
