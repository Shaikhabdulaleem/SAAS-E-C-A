import { useState } from 'react';
import { FileText, Plus, Search, Sparkles, Trash2, X } from 'lucide-react';
import { useData, type EmailTemplate } from '../../contexts/DataContext';
import { apiRequest } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';

const categories = ['promotional', 'newsletter', 'welcome', 'follow_up'];

function TemplateModal({ onClose, onSave, aiMode = false }: { onClose: () => void; onSave: (template: Omit<EmailTemplate, 'id' | 'createdAt'>) => void; aiMode?: boolean }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('promotional');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      let finalSubject = subject.trim() || name.trim();
      let finalBody = body.trim();
      if (aiMode) {
        const generated = await apiRequest<{ content: string }>('/ai/generate-email', {
          method: 'POST',
          body: JSON.stringify({ goal: body.trim() || name.trim() }),
        });
        finalBody = generated.content;
        finalSubject = finalSubject || generated.content.match(/^Subject:\s*(.+)$/m)?.[1] || name.trim();
      }
      if (!finalBody) finalBody = 'Write your reusable email content here.';
      onSave({ name: name.trim(), subject: finalSubject, body: finalBody, category });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-lg border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">{aiMode ? 'Generate Template' : 'Create Template'}</h2>
            <p className="text-xs text-muted-foreground">Saved templates are used as real campaign content.</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={event => setName(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <select value={category} onChange={event => setCategory(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
                {categories.map(item => <option key={item} value={item}>{item.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={subject} onChange={event => setSubject(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{aiMode ? 'Goal' : 'Body'}</Label>
            <Textarea value={body} onChange={event => setBody(event.target.value)} className="min-h-[160px]" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!name.trim() || saving}>
            {aiMode ? <Sparkles className="mr-2 h-4 w-4" /> : <FileText className="mr-2 h-4 w-4" />}
            Save Template
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Templates() {
  const { templates, addTemplate, deleteTemplate, apiError } = useData();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'blank' | 'ai' | null>(null);

  const filtered = templates.filter(template =>
    template.name.toLowerCase().includes(search.toLowerCase()) ||
    template.subject.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {modal && <TemplateModal aiMode={modal === 'ai'} onClose={() => setModal(null)} onSave={addTemplate} />}
      {apiError && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{apiError}</div>}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground">Email Templates</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Create and manage reusable campaign content.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setModal('ai')}>
            <Sparkles className="mr-1.5 h-4 w-4" />
            Generate
          </Button>
          <Button size="sm" onClick={() => setModal('blank')}>
            <Plus className="mr-1.5 h-4 w-4" />
            Create Template
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search templates..." value={search} onChange={event => setSearch(event.target.value)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map(template => (
          <Card key={template.id}>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground">{template.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{template.subject}</p>
                </div>
                {template.category && <Badge variant="secondary" className="capitalize">{template.category.replace(/_/g, ' ')}</Badge>}
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                <p className="line-clamp-5 whitespace-pre-wrap">{template.body}</p>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Created {new Date(template.createdAt).toLocaleDateString()}</span>
                <button className="inline-flex items-center gap-1 text-destructive hover:underline" onClick={() => {
                  if (window.confirm(`Delete ${template.name}?`)) deleteTemplate(template.id);
                }}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!filtered.length && (
        <Card>
          <CardContent className="py-14 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No templates found.</p>
            <Button className="mt-4" size="sm" onClick={() => setModal('blank')}>Create Template</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
