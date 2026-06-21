import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import {
  DEFAULT_TERMS_ITEMS,
  DEFAULT_TIMELINE_STEPS,
  type TermsItemData,
  type TimelineStepData,
} from '../proposals/ProposalFormContext';

interface ProposalTemplate {
  id: string;
  name: string;
  description?: string;
  style: string;
  aboutUsContent?: string;
  termsItems: TermsItemData[];
  timelineSteps: TimelineStepData[];
  isDefault: boolean;
}

const emptyForm = {
  name: '',
  description: '',
  style: 'modern',
  aboutUsContent: '',
  termsItems: DEFAULT_TERMS_ITEMS,
  timelineSteps: DEFAULT_TIMELINE_STEPS,
  isDefault: false,
};

export function ProposalTemplates({ admin = false }: { admin?: boolean }) {
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const basePath = admin ? '/admin/proposals' : '/proposals';

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<ProposalTemplate[]>(`${basePath}/template-presets`);
      setTemplates(Array.isArray(data) ? data : []);
    } catch { setTemplates([]); }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [admin]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const openEdit = (t: ProposalTemplate) => {
    setEditingId(t.id);
    setForm({
      name: t.name,
      description: t.description ?? '',
      style: t.style,
      aboutUsContent: t.aboutUsContent ?? '',
      termsItems: t.termsItems?.length ? t.termsItems : DEFAULT_TERMS_ITEMS,
      timelineSteps: t.timelineSteps?.length ? t.timelineSteps : DEFAULT_TIMELINE_STEPS,
      isDefault: t.isDefault,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        style: form.style,
        aboutUsContent: form.aboutUsContent || undefined,
        termsItems: form.termsItems.filter((t) => t.title.trim() || t.text.trim()),
        timelineSteps: form.timelineSteps.filter((s) => s.title.trim() || s.description.trim()),
        isDefault: form.isDefault,
      };
      if (editingId) {
        await apiRequest(`${basePath}/template-presets/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        setMessage('Template updated');
      } else {
        await apiRequest(`${basePath}/template-presets`, { method: 'POST', body: JSON.stringify(payload) });
        setMessage('Template created');
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiRequest(`${basePath}/template-presets/${id}`, { method: 'DELETE' });
      setMessage('Template deleted');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const updateTermItem = (index: number, field: keyof TermsItemData, value: string) => {
    setForm((prev) => {
      const items = [...prev.termsItems];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, termsItems: items };
    });
  };

  const updateTimelineStep = (index: number, field: keyof TimelineStepData, value: string) => {
    setForm((prev) => {
      const steps = [...prev.timelineSteps];
      steps[index] = { ...steps[index], [field]: value };
      return { ...prev, timelineSteps: steps };
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Proposal Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">Create reusable templates with custom About Us, Terms, and Timeline content.</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="h-3.5 w-3.5 mr-1.5" />New Template</Button>
      </div>

      {message && (
        <div className="rounded-lg border px-3 py-2 text-sm border-emerald-200 bg-emerald-50 text-emerald-800">{message}</div>
      )}

      {/* Template List */}
      {!showForm && (
        <div className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>}
          {!loading && templates.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No templates yet. Create one to get started.</p>
              </CardContent>
            </Card>
          )}
          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{t.name}</span>
                    <span className="text-xs rounded px-1.5 py-0.5 bg-muted text-muted-foreground capitalize">{t.style}</span>
                    {t.isDefault && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                  </div>
                  {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                    <span>{t.termsItems?.length ?? 0} terms</span>
                    <span>{t.timelineSteps?.length ?? 0} timeline steps</span>
                    {t.aboutUsContent && <span>Custom About Us</span>}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => openEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => void handleDelete(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editingId ? 'Edit Template' : 'Create Template'}</CardTitle>
            <CardDescription>Define reusable content for proposals.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Standard, Premium" />
                </div>
                <div className="space-y-1.5">
                  <Label>Style</Label>
                  <Select value={form.style} onValueChange={(v) => setForm((p) => ({ ...p, style: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="modern">Modern</SelectItem>
                      <SelectItem value="classic">Classic</SelectItem>
                      <SelectItem value="minimal">Minimal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional description" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setForm((p) => ({ ...p, isDefault: !p.isDefault }))} className={`h-5 w-5 rounded border flex items-center justify-center ${form.isDefault ? 'bg-primary border-primary text-white' : 'border-muted-foreground/30'}`}>
                  {form.isDefault && <span className="text-xs">✓</span>}
                </button>
                <Label className="text-sm cursor-pointer" onClick={() => setForm((p) => ({ ...p, isDefault: !p.isDefault }))}>Set as default template for new proposals</Label>
              </div>

              {/* About Us */}
              <div className="space-y-1.5">
                <Label>About Us Content</Label>
                <Textarea rows={4} placeholder="Enter your company's About Us text..." value={form.aboutUsContent} onChange={(e) => setForm((p) => ({ ...p, aboutUsContent: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Leave empty to use the default from Brand Settings.</p>
              </div>

              {/* Terms */}
              <div className="space-y-2">
                <Label>Terms & Conditions</Label>
                {form.termsItems.map((term, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <Input className="w-32 h-8 text-xs" placeholder="Title" value={term.title} onChange={(e) => updateTermItem(i, 'title', e.target.value)} />
                    <Input className="flex-1 h-8 text-xs" placeholder="Description" value={term.text} onChange={(e) => updateTermItem(i, 'text', e.target.value)} />
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => setForm((p) => ({ ...p, termsItems: p.termsItems.filter((_, idx) => idx !== i) }))}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setForm((p) => ({ ...p, termsItems: [...p.termsItems, { title: '', text: '' }] }))}>
                  <Plus className="h-3 w-3 mr-1" />Add Term
                </Button>
              </div>

              {/* Timeline */}
              <div className="space-y-2">
                <Label>Implementation Timeline</Label>
                {form.timelineSteps.map((step, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <Input className="w-48 h-8 text-xs" placeholder="Step title" value={step.title} onChange={(e) => updateTimelineStep(i, 'title', e.target.value)} />
                    <Input className="flex-1 h-8 text-xs" placeholder="Description" value={step.description} onChange={(e) => updateTimelineStep(i, 'description', e.target.value)} />
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => setForm((p) => ({ ...p, timelineSteps: p.timelineSteps.filter((_, idx) => idx !== i) }))}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setForm((p) => ({ ...p, timelineSteps: [...p.timelineSteps, { title: '', description: '' }] }))}>
                  <Plus className="h-3 w-3 mr-1" />Add Step
                </Button>
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button type="submit">{editingId ? 'Update Template' : 'Create Template'}</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
