import { useEffect, useState } from 'react';
import { Wand2, Plus, Pencil, Trash2, GripVertical, AlertCircle } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '../../components/ui/dialog';

interface OnboardingItem {
  key: string;
  label: string;
}

interface OnboardingTemplate {
  id: string;
  name: string;
  description: string;
  items: OnboardingItem[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

const emptyForm = (): { name: string; description: string; items: OnboardingItem[]; isDefault: boolean } => ({
  name: '',
  description: '',
  items: [{ key: '', label: '' }],
  isDefault: false,
});

export function OnboardingTemplates() {
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const fetchTemplates = () => {
    setLoading(true);
    setError(null);
    apiRequest<OnboardingTemplate[]>('/admin/onboarding-templates')
      .then((res) => setTemplates(res))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load templates'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (template: OnboardingTemplate) => {
    setEditingId(template.id);
    setForm({
      name: template.name,
      description: template.description,
      items: template.items.length > 0 ? [...template.items] : [{ key: '', label: '' }],
      isDefault: template.isDefault,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    try {
      await apiRequest(`/admin/onboarding-templates/${id}`, { method: 'DELETE' });
      fetchTemplates();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, { key: '', label: '' }] }));
  };

  const removeItem = (index: number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const updateItem = (index: number, field: 'key' | 'label', value: string) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = JSON.stringify({
        name: form.name,
        description: form.description,
        items: form.items.filter((item) => item.key.trim() && item.label.trim()),
        isDefault: form.isDefault,
      });

      if (editingId) {
        await apiRequest(`/admin/onboarding-templates/${editingId}`, { method: 'PATCH', body });
      } else {
        await apiRequest('/admin/onboarding-templates', { method: 'POST', body });
      }

      setModalOpen(false);
      fetchTemplates();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wand2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Onboarding Templates</h1>
            <p className="text-sm text-muted-foreground">
              Define reusable checklists for new client onboarding
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
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

      {/* Templates List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-32 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No onboarding templates yet. Create your first template to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{template.name}</CardTitle>
                    {template.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {template.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    {template.isDefault && (
                      <Badge variant="default" className="text-[10px]">
                        Default
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary" className="text-xs">
                    {template.items.length} item{template.items.length !== 1 ? 's' : ''}
                  </Badge>
                </div>

                {/* Checklist Preview */}
                {template.items.length > 0 && (
                  <div className="space-y-1.5 mb-4">
                    {template.items.slice(0, 5).map((item, index) => (
                      <div key={item.key} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="h-5 w-5 rounded-full border border-muted-foreground/30 flex items-center justify-center text-[10px] font-medium shrink-0">
                          {index + 1}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </div>
                    ))}
                    {template.items.length > 5 && (
                      <p className="text-[10px] text-muted-foreground pl-7">
                        +{template.items.length - 5} more items
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-3 border-t">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(template)}>
                    <Pencil className="h-3 w-3 mr-1.5" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(template.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Template' : 'Create Template'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update the onboarding template details.' : 'Define a new onboarding checklist template.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Standard Onboarding"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-desc">Description</Label>
              <Textarea
                id="template-desc"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this template..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="template-default">Set as Default</Label>
              <Switch
                id="template-default"
                checked={form.isDefault}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isDefault: checked }))}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Checklist Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Item
                </Button>
              </div>

              <div className="space-y-2">
                {form.items.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      placeholder="Key (e.g. setup_dns)"
                      value={item.key}
                      onChange={(e) => updateItem(index, 'key', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Label (e.g. Setup DNS Records)"
                      value={item.label}
                      onChange={(e) => updateItem(index, 'label', e.target.value)}
                      className="flex-1"
                    />
                    {form.items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive shrink-0"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
