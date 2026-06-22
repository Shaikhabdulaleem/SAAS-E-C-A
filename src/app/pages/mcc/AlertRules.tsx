import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Bell, Plus, Pencil, Trash2, AlertCircle, Play, CheckCircle } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationPrevious, PaginationNext, PaginationEllipsis,
} from '../../components/ui/pagination';

interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  operator: string;
  threshold: number;
  severity: string;
  isActive: boolean;
  createdAt: string;
}

interface AlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  tenantId: string;
  companyName: string;
  severity: string;
  message: string;
  resolved: boolean;
  createdAt: string;
}

interface PaginatedEvents {
  items: AlertEvent[];
  pagination: { page: number; pageSize: number; total: number };
}

const METRICS = [
  { value: 'health_score', label: 'Health Score' },
  { value: 'login_recency', label: 'Login Recency' },
  { value: 'payment_status', label: 'Payment Status' },
  { value: 'domain_health', label: 'Domain Health' },
];

const OPERATORS = [
  { value: 'lt', label: '< (Less than)' },
  { value: 'gt', label: '> (Greater than)' },
  { value: 'eq', label: '= (Equal to)' },
  { value: 'lte', label: '<= (Less or equal)' },
  { value: 'gte', label: '>= (Greater or equal)' },
];

const SEVERITIES = [
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

const SEVERITY_COLORS: Record<string, string> = {
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
};

const emptyForm = () => ({
  name: '',
  description: '',
  metric: 'health_score',
  operator: 'lt',
  threshold: 0,
  severity: 'warning',
  isActive: true,
});

function buildPaginationPages(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | 'ellipsis')[] = [1];
  if (current > 3) pages.push('ellipsis');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push('ellipsis');
  pages.push(total);
  return pages;
}

export function AlertRules() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  // Events
  const [events, setEvents] = useState<PaginatedEvents | null>(null);
  const [eventsPage, setEventsPage] = useState(1);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const fetchRules = () => {
    setLoading(true);
    setError(null);
    apiRequest<AlertRule[]>('/admin/alerts/rules')
      .then((res) => setRules(res))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load alert rules'))
      .finally(() => setLoading(false));
  };

  const fetchEvents = () => {
    setLoadingEvents(true);
    apiRequest<PaginatedEvents>(`/admin/alerts/events?page=${eventsPage}`)
      .then((res) => setEvents(res))
      .catch(() => {})
      .finally(() => setLoadingEvents(false));
  };

  useEffect(() => {
    fetchRules();
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [eventsPage]);

  const handleEvaluate = async () => {
    setEvaluating(true);
    try {
      await apiRequest('/admin/alerts/evaluate');
      fetchEvents();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (rule: AlertRule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      description: rule.description,
      metric: rule.metric,
      operator: rule.operator,
      threshold: rule.threshold,
      severity: rule.severity,
      isActive: rule.isActive,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this alert rule?')) return;
    try {
      await apiRequest(`/admin/alerts/rules/${id}`, { method: 'DELETE' });
      fetchRules();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = JSON.stringify(form);
      if (editingId) {
        await apiRequest(`/admin/alerts/rules/${editingId}`, { method: 'PATCH', body });
      } else {
        await apiRequest('/admin/alerts/rules', { method: 'POST', body });
      }
      setModalOpen(false);
      fetchRules();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleRuleActive = async (rule: AlertRule) => {
    try {
      await apiRequest(`/admin/alerts/rules/${rule.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, isActive: !r.isActive } : r)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Toggle failed');
    }
  };

  const resolveEvent = async (eventId: string) => {
    try {
      await apiRequest(`/admin/alerts/events/${eventId}/resolve`, { method: 'PATCH' });
      fetchEvents();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Resolve failed');
    }
  };

  const eventsTotalPages = events ? Math.ceil(events.pagination.total / events.pagination.pageSize) : 0;
  const eventsPaginationPages = buildPaginationPages(eventsPage, eventsTotalPages);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Alert Rules</h1>
            <p className="text-sm text-muted-foreground">
              Configure automated alerts based on tenant metrics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleEvaluate} disabled={evaluating}>
            <Play className="h-4 w-4 mr-2" />
            {evaluating ? 'Evaluating...' : 'Evaluate Now'}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Rule
          </Button>
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

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {loading ? 'Loading...' : `${rules.length} rule${rules.length !== 1 ? 's' : ''}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Metric</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Operator</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Threshold</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Severity</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Active</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                      Loading alert rules...
                    </td>
                  </tr>
                ) : rules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                      No alert rules defined yet.
                    </td>
                  </tr>
                ) : (
                  rules.map((rule) => (
                    <tr key={rule.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 font-medium">{rule.name}</td>
                      <td className="py-3 px-4">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                          {rule.metric}
                        </code>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{rule.operator}</td>
                      <td className="py-3 px-4 text-right font-mono">{rule.threshold}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant="outline"
                          className={`text-xs capitalize ${SEVERITY_COLORS[rule.severity] ?? ''}`}
                        >
                          {rule.severity}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Switch
                          checked={rule.isActive}
                          onCheckedChange={() => toggleRuleActive(rule)}
                        />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(rule.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Alert Events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Alert Events
          </CardTitle>
          <CardDescription>
            Recent alert events triggered by rules
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Timestamp</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tenant</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Rule</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Severity</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Message</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingEvents && !events ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                      Loading events...
                    </td>
                  </tr>
                ) : events && events.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                      No alert events.
                    </td>
                  </tr>
                ) : (
                  events?.items.map((event) => (
                    <tr key={event.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(event.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          to={`/mcc/tenants/${event.tenantId}`}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {event.companyName}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-xs">{event.ruleName}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant="outline"
                          className={`text-xs capitalize ${SEVERITY_COLORS[event.severity] ?? ''}`}
                        >
                          {event.severity}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground max-w-[250px] truncate">
                        {event.message}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!event.resolved && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resolveEvent(event.id)}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Resolve
                          </Button>
                        )}
                        {event.resolved && (
                          <Badge variant="secondary" className="text-xs">Resolved</Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {eventsTotalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={(e) => { e.preventDefault(); if (eventsPage > 1) setEventsPage(eventsPage - 1); }}
                      className={eventsPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      href="#"
                    />
                  </PaginationItem>
                  {eventsPaginationPages.map((p, i) =>
                    p === 'ellipsis' ? (
                      <PaginationItem key={`ellipsis-${i}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={p}>
                        <PaginationLink
                          onClick={(e) => { e.preventDefault(); setEventsPage(p); }}
                          isActive={eventsPage === p}
                          href="#"
                          className="cursor-pointer"
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}
                  <PaginationItem>
                    <PaginationNext
                      onClick={(e) => { e.preventDefault(); if (eventsPage < eventsTotalPages) setEventsPage(eventsPage + 1); }}
                      className={eventsPage >= eventsTotalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      href="#"
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Alert Rule' : 'Create Alert Rule'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update alert rule configuration.' : 'Define a new alert rule.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rule-name">Name</Label>
              <Input
                id="rule-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Low Health Score Alert"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-desc">Description</Label>
              <Textarea
                id="rule-desc"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Describe what this rule monitors..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Metric</Label>
                <Select value={form.metric} onValueChange={(val) => setForm((p) => ({ ...p, metric: val }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METRICS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Operator</Label>
                <Select value={form.operator} onValueChange={(val) => setForm((p) => ({ ...p, operator: val }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rule-threshold">Threshold</Label>
                <Input
                  id="rule-threshold"
                  type="number"
                  value={form.threshold}
                  onChange={(e) => setForm((p) => ({ ...p, threshold: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={(val) => setForm((p) => ({ ...p, severity: val }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="rule-active">Active</Label>
                <p className="text-xs text-muted-foreground">Enable or disable this rule</p>
              </div>
              <Switch
                id="rule-active"
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((p) => ({ ...p, isActive: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
