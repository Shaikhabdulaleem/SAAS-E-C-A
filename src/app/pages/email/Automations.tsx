import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Plus, Zap, Play, Pause, Trash2, Users, ChevronRight, Mail, Clock, Tag } from 'lucide-react';
import { apiRequest } from '../../lib/api';

type AutomationStep = { id: string; stepOrder: number; type: string; name?: string; config: Record<string, unknown> };
type Automation = {
  id: string; name: string; description?: string; trigger: string; status: string;
  enrolledCount: number; completedCount: number; createdAt: string;
  steps: AutomationStep[]; _count?: { executions: number };
};

const triggerLabels: Record<string, string> = {
  manual: 'Manual', contact_added: 'Contact Added', tag_added: 'Tag Added',
  form_submitted: 'Form Submitted', date_based: 'Date-Based',
};
const stepTypeLabels: Record<string, { label: string; icon: typeof Mail }> = {
  send_email: { label: 'Send Email', icon: Mail },
  wait_delay: { label: 'Wait', icon: Clock },
  add_tag: { label: 'Add Tag', icon: Tag },
  remove_tag: { label: 'Remove Tag', icon: Tag },
  condition: { label: 'Condition', icon: ChevronRight },
  update_contact: { label: 'Update Contact', icon: Users },
  wait_until: { label: 'Wait Until', icon: Clock },
};

export function Automations() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Automation | null>(null);
  const [form, setForm] = useState({ name: '', description: '', trigger: 'manual' });
  const [stepForm, setStepForm] = useState({ type: 'send_email', name: '', config: '{}' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => apiRequest<Automation[]>('/email/automations').then(setAutomations).catch(() => {});
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    apiRequest<Automation>(`/email/automations/${selectedId}`).then(setDetail).catch(() => {});
  }, [selectedId]);

  const createAutomation = async () => {
    if (!form.name.trim()) return setError('Name is required');
    try {
      await apiRequest('/email/automations', { method: 'POST', body: JSON.stringify(form) });
      setShowCreate(false); setForm({ name: '', description: '', trigger: 'manual' }); load(); setNotice('Automation created');
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to create'); }
  };

  const activate = async (id: string) => {
    try { await apiRequest(`/email/automations/${id}/activate`, { method: 'POST' }); load(); setNotice('Automation activated'); if (selectedId === id) setSelectedId(id); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
  };
  const pause = async (id: string) => {
    try { await apiRequest(`/email/automations/${id}/pause`, { method: 'POST' }); load(); setNotice('Automation paused'); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
  };
  const remove = async (id: string) => {
    if (!confirm('Delete this automation?')) return;
    await apiRequest(`/email/automations/${id}`, { method: 'DELETE' }); load(); if (selectedId === id) setSelectedId(null);
  };
  const addStep = async () => {
    if (!selectedId) return;
    try {
      const config = JSON.parse(stepForm.config);
      await apiRequest(`/email/automations/${selectedId}/steps`, { method: 'POST', body: JSON.stringify({ type: stepForm.type, name: stepForm.name || undefined, config }) });
      setStepForm({ type: 'send_email', name: '', config: '{}' });
      apiRequest<Automation>(`/email/automations/${selectedId}`).then(setDetail);
      setNotice('Step added');
    } catch (err) { setError(err instanceof Error ? err.message : 'Invalid config JSON'); }
  };
  const removeStep = async (stepId: string) => {
    if (!selectedId) return;
    await apiRequest(`/email/automations/${selectedId}/steps/${stepId}`, { method: 'DELETE' });
    apiRequest<Automation>(`/email/automations/${selectedId}`).then(setDetail);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6 text-indigo-600" />
          <h1 className="text-2xl font-semibold text-gray-900">Automations</h1>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
          <Plus className="h-4 w-4" /> New Automation
        </button>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      {notice && <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm">{notice}</div>}

      {showCreate && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Create Automation</h2>
          <input placeholder="Automation name" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input placeholder="Description (optional)" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={form.trigger} onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))}>
            {Object.entries(triggerLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={createAutomation} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-300 text-sm rounded-md hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3">
          {automations.map(a => (
            <div key={a.id} onClick={() => setSelectedId(a.id)} className={`bg-white rounded-lg shadow p-4 cursor-pointer hover:ring-2 hover:ring-indigo-200 transition ${selectedId === a.id ? 'ring-2 ring-indigo-400' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900 truncate">{a.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === 'active' ? 'bg-green-100 text-green-700' : a.status === 'paused' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{a.status}</span>
              </div>
              <p className="text-xs text-gray-500">{triggerLabels[a.trigger] ?? a.trigger} &middot; {a.steps.length} steps &middot; {a.enrolledCount} enrolled</p>
              <div className="flex gap-1 mt-2">
                {a.status === 'draft' || a.status === 'paused' ? (
                  <button onClick={e => { e.stopPropagation(); activate(a.id); }} className="p-1 text-green-600 hover:bg-green-50 rounded"><Play className="h-3.5 w-3.5" /></button>
                ) : (
                  <button onClick={e => { e.stopPropagation(); pause(a.id); }} className="p-1 text-yellow-600 hover:bg-yellow-50 rounded"><Pause className="h-3.5 w-3.5" /></button>
                )}
                <button onClick={e => { e.stopPropagation(); remove(a.id); }} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
          {automations.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">No automations yet</div>}
        </div>

        <div className="lg:col-span-2">
          {detail ? (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">{detail.name}</h2>
                {detail.description && <p className="text-sm text-gray-500 mt-1">{detail.description}</p>}
                <div className="flex gap-4 mt-3 text-sm text-gray-600">
                  <span>Trigger: {triggerLabels[detail.trigger]}</span>
                  <span>Enrolled: {detail.enrolledCount}</span>
                  <span>Completed: {detail.completedCount}</span>
                </div>
              </div>

              <div className="p-6">
                <h3 className="font-medium text-gray-900 mb-4">Steps</h3>
                <div className="space-y-3">
                  {detail.steps.map((step, idx) => {
                    const typeInfo = stepTypeLabels[step.type] ?? { label: step.type, icon: ChevronRight };
                    const StepIcon = typeInfo.icon;
                    return (
                      <div key={step.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                        <span className="text-xs text-gray-400 w-6">{idx + 1}</span>
                        <div className="p-1.5 rounded bg-indigo-50"><StepIcon className="h-4 w-4 text-indigo-600" /></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{step.name || typeInfo.label}</p>
                          <p className="text-xs text-gray-500">{step.type === 'wait_delay' ? `Wait ${(step.config as any).days ?? 1} day(s)` : step.type === 'send_email' ? `Subject: ${(step.config as any).subject ?? '(none)'}` : step.type === 'add_tag' || step.type === 'remove_tag' ? `Tag: ${(step.config as any).tag ?? ''}` : typeInfo.label}</p>
                        </div>
                        <button onClick={() => removeStep(step.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 p-4 bg-gray-50 rounded-lg space-y-3">
                  <h4 className="text-sm font-medium text-gray-700">Add Step</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <select className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={stepForm.type} onChange={e => setStepForm(f => ({ ...f, type: e.target.value }))}>
                      {Object.entries(stepTypeLabels).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <input placeholder="Step name (optional)" className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={stepForm.name} onChange={e => setStepForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <textarea rows={3} placeholder='Config JSON, e.g. {"subject":"Welcome","body":"<p>Hi!</p>","fromEmail":"you@domain.com","fromName":"Team"}' className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono" value={stepForm.config} onChange={e => setStepForm(f => ({ ...f, config: e.target.value }))} />
                  <button onClick={addStep} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700">Add Step</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
              <Zap className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Select an automation to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
