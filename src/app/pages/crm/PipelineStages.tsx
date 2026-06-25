import { useState, useEffect } from 'react';
import { Plus, GripVertical, Pencil, Trash2, Check, X } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';

interface Stage {
  id: string;
  name: string;
  order: number;
  color?: string;
}

const STAGE_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export function PipelineStages() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const fetchStages = () => {
    apiRequest<Stage[]>('/pipeline-stages')
      .then(data => setStages(Array.isArray(data) ? data.sort((a, b) => a.order - b.order) : []))
      .catch(() => setStages([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStages(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await apiRequest('/pipeline-stages', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), order: stages.length }),
      });
      setNewName('');
      fetchStages();
    } catch {}
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await apiRequest(`/pipeline-stages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName.trim() }),
      });
      setEditingId(null);
      fetchStages();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this pipeline stage?')) return;
    try {
      await apiRequest(`/pipeline-stages/${id}`, { method: 'DELETE' });
      fetchStages();
    } catch {}
  };

  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Define the stages of your sales pipeline. Deals move through these stages from left to right.
      </p>

      <div className="space-y-2">
        {stages.map((stage, i) => (
          <Card key={stage.id} className="p-0">
            <CardContent className="p-3 flex items-center gap-3">
              <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              <div
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length] }}
              />
              {editingId === stage.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleUpdate(stage.id)}
                    className="h-8 flex-1"
                    autoFocus
                  />
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleUpdate(stage.id)}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium">{stage.name}</span>
                  <Badge variant="secondary" className="text-xs">{i + 1}</Badge>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setEditingId(stage.id); setEditName(stage.name); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDelete(stage.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="New stage name..."
          className="flex-1"
        />
        <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>
          <Plus className="h-4 w-4 mr-1" />
          Add Stage
        </Button>
      </div>

      {stages.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No pipeline stages configured.</p>
          <p className="text-xs mt-1">Add stages like "Lead", "Qualified", "Proposal", "Negotiation", "Closed Won".</p>
        </div>
      )}
    </div>
  );
}
