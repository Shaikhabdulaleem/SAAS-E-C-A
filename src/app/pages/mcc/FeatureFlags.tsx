import { useEffect, useState } from 'react';
import { ToggleLeft, Plus, Pencil, Trash2, AlertCircle, Users } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  isGlobal: boolean;
  defaultOn: boolean;
  overrideCount: number;
  createdAt: string;
}

interface TenantFlag {
  flagId: string;
  key: string;
  name: string;
  enabled: boolean;
  isOverridden: boolean;
}

interface Tenant {
  id: string;
  companyName: string;
}

const emptyForm = () => ({
  key: '',
  name: '',
  description: '',
  isGlobal: false,
  defaultOn: false,
});

export function FeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // Per-tenant view
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [tenantFlags, setTenantFlags] = useState<TenantFlag[]>([]);
  const [loadingTenant, setLoadingTenant] = useState(false);

  const fetchFlags = () => {
    setLoading(true);
    setError(null);
    apiRequest<FeatureFlag[]>('/admin/feature-flags')
      .then((res) => setFlags(res))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load feature flags'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFlags();
    apiRequest<Tenant[]>('/admin/tenants')
      .then((res) => setTenants(Array.isArray(res) ? res : []))
      .catch(() => {});
  }, []);

  const fetchTenantFlags = (tenantId: string) => {
    if (!tenantId) return;
    setLoadingTenant(true);
    apiRequest<TenantFlag[]>(`/admin/feature-flags/tenant/${tenantId}`)
      .then((res) => setTenantFlags(res))
      .catch(() => setTenantFlags([]))
      .finally(() => setLoadingTenant(false));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (flag: FeatureFlag) => {
    setEditingId(flag.id);
    setForm({
      key: flag.key,
      name: flag.name,
      description: flag.description,
      isGlobal: flag.isGlobal,
      defaultOn: flag.defaultOn,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this feature flag?')) return;
    try {
      await apiRequest(`/admin/feature-flags/${id}`, { method: 'DELETE' });
      fetchFlags();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = JSON.stringify(form);
      if (editingId) {
        await apiRequest(`/admin/feature-flags/${editingId}`, { method: 'PATCH', body });
      } else {
        await apiRequest('/admin/feature-flags', { method: 'POST', body });
      }
      setModalOpen(false);
      fetchFlags();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleTenantFlag = async (flagId: string, enabled: boolean) => {
    try {
      await apiRequest(`/admin/feature-flags/tenant/${selectedTenantId}/${flagId}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
      setTenantFlags((prev) =>
        prev.map((f) => (f.flagId === flagId ? { ...f, enabled, isOverridden: true } : f)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle flag');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ToggleLeft className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Feature Flags</h1>
            <p className="text-sm text-muted-foreground">
              Manage feature flags and per-tenant overrides
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Flag
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

      {/* Flags Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {loading ? 'Loading...' : `${flags.length} feature flag${flags.length !== 1 ? 's' : ''}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Key</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Description</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Global</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Default On</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Overrides</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                      Loading feature flags...
                    </td>
                  </tr>
                ) : flags.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                      No feature flags yet.
                    </td>
                  </tr>
                ) : (
                  flags.map((flag) => (
                    <tr key={flag.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                          {flag.key}
                        </code>
                      </td>
                      <td className="py-3 px-4 font-medium">{flag.name}</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs max-w-[200px] truncate">
                        {flag.description || '--'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {flag.isGlobal ? (
                          <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-xs">Global</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">No</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {flag.defaultOn ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">On</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Off</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="outline" className="text-xs">
                          {flag.overrideCount ?? 0}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(flag)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(flag.id)}
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

      {/* Per-Tenant Overrides */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Per-Tenant Overrides
          </CardTitle>
          <CardDescription>
            Select a tenant to view and toggle feature flag overrides
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4 mb-4">
            <div className="space-y-2 flex-1 max-w-xs">
              <Label>Tenant</Label>
              <Select
                value={selectedTenantId}
                onValueChange={(val) => {
                  setSelectedTenantId(val);
                  fetchTenantFlags(val);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedTenantId && (
            <div className="overflow-x-auto">
              {loadingTenant ? (
                <div className="h-24 bg-muted rounded animate-pulse" />
              ) : tenantFlags.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No flags available for this tenant.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Key</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                      <th className="text-center py-3 px-4 font-medium text-muted-foreground">Enabled</th>
                      <th className="text-center py-3 px-4 font-medium text-muted-foreground">Overridden</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantFlags.map((tf) => (
                      <tr key={tf.flagId} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                            {tf.key}
                          </code>
                        </td>
                        <td className="py-3 px-4 font-medium">{tf.name}</td>
                        <td className="py-3 px-4 text-center">
                          <Switch
                            checked={tf.enabled}
                            onCheckedChange={(checked) => toggleTenantFlag(tf.flagId, checked)}
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          {tf.isOverridden ? (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                              Overridden
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Default</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Feature Flag' : 'Create Feature Flag'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update the feature flag details.' : 'Define a new feature flag.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="flag-key">Key (slug)</Label>
              <Input
                id="flag-key"
                value={form.key}
                onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))}
                placeholder="e.g. new_dashboard_v2"
                disabled={!!editingId}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="flag-name">Name</Label>
              <Input
                id="flag-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="New Dashboard V2"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="flag-desc">Description</Label>
              <Input
                id="flag-desc"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="What this flag controls..."
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="flag-global">Global</Label>
                <p className="text-xs text-muted-foreground">Apply to all tenants</p>
              </div>
              <Switch
                id="flag-global"
                checked={form.isGlobal}
                onCheckedChange={(checked) => setForm((p) => ({ ...p, isGlobal: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="flag-default">Default On</Label>
                <p className="text-xs text-muted-foreground">Enabled by default for all tenants</p>
              </div>
              <Switch
                id="flag-default"
                checked={form.defaultOn}
                onCheckedChange={(checked) => setForm((p) => ({ ...p, defaultOn: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.key.trim() || !form.name.trim()}>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
