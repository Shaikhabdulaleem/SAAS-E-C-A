import { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { Link } from 'react-router';
import { Plus, DollarSign, Calendar, LayoutGrid, List, ChevronRight, Target, TrendingUp, Trophy, MoreHorizontal, X } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Separator } from '../../components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

const stageConfig: Record<string, { label: string; color: string; bg: string; accent: string }> = {
  lead: { label: 'Lead', color: 'text-amber-700', bg: 'bg-amber-50', accent: 'border-t-amber-400' },
  qualified: { label: 'Qualified', color: 'text-sky-700', bg: 'bg-sky-50', accent: 'border-t-sky-400' },
  proposal: { label: 'Proposal', color: 'text-violet-700', bg: 'bg-violet-50', accent: 'border-t-violet-400' },
  negotiation: { label: 'Negotiation', color: 'text-orange-700', bg: 'bg-orange-50', accent: 'border-t-orange-400' },
  closed: { label: 'Closed Won', color: 'text-emerald-700', bg: 'bg-emerald-50', accent: 'border-t-emerald-400' },
};

const stages = ['lead', 'qualified', 'proposal', 'negotiation', 'closed'];

export function Deals() {
  const { deals, companies, addDeal, updateDeal, deleteDeal, apiError } = useData();
  const [view, setView] = useState<'board' | 'list'>('board');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    title: '',
    value: '',
    stage: 'lead',
    companyId: 'none',
    assignedTo: '',
    probability: '10',
    expectedCloseDate: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const getCompanyName = (companyId?: string) => {
    if (!companyId) return null;
    return companies.find(c => c.id === companyId)?.name;
  };

  const getDealsByStage = (stage: string) =>
    deals.filter(d => d.stage === stage && d.status === 'open');

  const openDeals = deals.filter(d => d.status === 'open');
  const totalPipelineValue = openDeals.reduce((sum, deal) => sum + deal.value, 0);

  const set = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => { const next = { ...e }; delete next[field]; return next; });
  };

  const openNewDeal = (stage = 'lead') => {
    setForm({ title: '', value: '', stage, companyId: 'none', assignedTo: '', probability: stage === 'negotiation' ? '80' : '10', expectedCloseDate: '' });
    setErrors({});
    setShowModal(true);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!form.title.trim()) nextErrors.title = 'Deal title is required';
    if (form.value && Number.isNaN(Number(form.value))) nextErrors.value = 'Value must be a number';
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    addDeal({
      title: form.title.trim(),
      value: Number(form.value || 0),
      currency: 'USD',
      stage: form.stage,
      companyId: form.companyId === 'none' ? undefined : form.companyId,
      assignedTo: form.assignedTo,
      status: 'open',
      probability: Number(form.probability || 0),
      expectedCloseDate: form.expectedCloseDate || undefined,
    });
    setShowModal(false);
  };

  const advanceStage = (deal: typeof deals[number]) => {
    const currentIndex = stages.indexOf(deal.stage);
    const nextStage = stages[Math.min(currentIndex + 1, stages.length - 1)];
    updateDeal(deal.id, { stage: nextStage, status: nextStage === 'closed' ? 'won' : deal.status });
  };

  return (
    <div className="max-w-full space-y-5">
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-lg border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground">New Deal</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Add an opportunity to the pipeline</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label>Deal Title</Label>
                <Input value={form.title} onChange={e => set('title', e.target.value)} className={errors.title ? 'border-destructive' : ''} />
                {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Value</Label>
                  <Input value={form.value} onChange={e => set('value', e.target.value)} placeholder="12000" className={errors.value ? 'border-destructive' : ''} />
                  {errors.value && <p className="text-xs text-destructive">{errors.value}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Probability</Label>
                  <Input value={form.probability} onChange={e => set('probability', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Stage</Label>
                  <Select value={form.stage} onValueChange={v => set('stage', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {stages.map(stage => <SelectItem key={stage} value={stage}>{stageConfig[stage].label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Company</Label>
                  <Select value={form.companyId} onValueChange={v => set('companyId', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No company</SelectItem>
                      {companies.map(company => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Expected Close Date</Label>
                <Input type="date" value={form.expectedCloseDate} onChange={e => set('expectedCloseDate', e.target.value)} />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border mt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" />Create Deal</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {apiError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {apiError}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-foreground">Deals Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track and manage your sales opportunities</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setView('board')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'board' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Board
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
          </div>
          <Button size="sm" onClick={() => openNewDeal()}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Deal
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Pipeline', value: `$${(totalPipelineValue / 1000).toFixed(0)}K`, icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Open Deals', value: openDeals.length.toString(), icon: TrendingUp, color: 'text-sky-600', bg: 'bg-sky-50' },
          { label: 'Won This Month', value: deals.filter(d => d.status === 'won').length.toString(), icon: Trophy, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Avg Deal Size', value: `$${Math.round(totalPipelineValue / Math.max(openDeals.length, 1)).toLocaleString()}`, icon: DollarSign, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(stat => (
          <Card key={stat.label} className="p-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                <stat.icon className={`h-4.5 w-4.5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-semibold text-foreground">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Kanban Board */}
      {view === 'board' && (
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
          {stages.map((stage) => {
            const stageDeals = getDealsByStage(stage);
            const stageValue = stageDeals.reduce((sum, d) => sum + d.value, 0);
            const cfg = stageConfig[stage];

            return (
              <div key={stage} className="flex-shrink-0 w-72">
                <div className="bg-muted/40 rounded-xl overflow-hidden border border-border">
                  {/* Column header */}
                  <div className="px-4 py-3 bg-background border-b border-border">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${cfg.bg} border-2 ${cfg.color.replace('text-', 'border-')}`} />
                        <h3 className="text-sm font-semibold text-foreground">{cfg.label}</h3>
                      </div>
                      <Badge variant="secondary" className="text-xs h-5 px-1.5">{stageDeals.length}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground ml-4">${stageValue.toLocaleString()}</p>
                  </div>

                  {/* Cards */}
                  <div className="p-2.5 space-y-2.5 min-h-[300px]">
                    {stageDeals.map((deal) => (
                      <Link
                        key={deal.id}
                        to={`/deals/${deal.id}`}
                        className={`block p-3.5 bg-background rounded-lg border border-border border-t-2 ${cfg.accent} hover:shadow-sm transition-all group`}
                      >
                        <h4 className="text-sm font-medium text-foreground mb-1.5 group-hover:text-primary transition-colors line-clamp-2">{deal.title}</h4>
                        {getCompanyName(deal.companyId) && (
                          <p className="text-xs text-muted-foreground mb-2.5">{getCompanyName(deal.companyId)}</p>
                        )}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-foreground">
                            ${deal.value.toLocaleString()}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] h-4 px-1 ${cfg.color} ${cfg.bg}`}
                          >
                            {deal.probability}%
                          </Badge>
                        </div>
                        <Progress value={deal.probability} className="h-1 mb-2.5" />
                        {(deal.interestedServices ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {deal.interestedServices.slice(0, 2).map((svc: string) => (
                              <span key={svc} className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                                {svc.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                              </span>
                            ))}
                            {deal.interestedServices.length > 2 && <span className="text-[10px] text-muted-foreground">+{deal.interestedServices.length - 2}</span>}
                          </div>
                        )}
                        {deal.expectedCloseDate && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(deal.expectedCloseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        )}
                      </Link>
                    ))}
                    <button onClick={() => openNewDeal(stage)} className="w-full py-2 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:border-primary/40 hover:text-primary/70 transition-colors flex items-center justify-center gap-1">
                      <Plus className="h-3 w-3" />
                      Add deal
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Deal</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Company</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Value</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Stage</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Probability</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Close Date</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Owner</th>
                  <th className="px-5 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deals.filter(d => d.status === 'open').map((deal) => {
                  const cfg = stageConfig[deal.stage] || stageConfig.lead;
                  return (
                    <tr key={deal.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-5 py-3.5">
                        <Link to={`/deals/${deal.id}`} className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {deal.title}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell text-sm text-muted-foreground">
                        {getCompanyName(deal.companyId) || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-semibold text-foreground">${deal.value.toLocaleString()}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant="outline" className={`text-xs ${cfg.color} ${cfg.bg}`}>
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <Progress value={deal.probability} className="h-1.5 w-16" />
                          <span className="text-xs text-muted-foreground">{deal.probability}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell text-sm text-muted-foreground">
                        {deal.expectedCloseDate
                          ? new Date(deal.expectedCloseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell text-sm text-muted-foreground">{deal.assignedTo}</td>
                      <td className="px-5 py-3.5">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild><Link to={`/deals/${deal.id}`}>View Details</Link></DropdownMenuItem>
                            <DropdownMenuItem onClick={() => advanceStage(deal)}>Edit Stage</DropdownMenuItem>
                            <Separator className="my-1" />
                            <DropdownMenuItem className="text-destructive" onClick={() => {
                              if (window.confirm(`Delete ${deal.title}?`)) deleteDeal(deal.id);
                            }}>Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
