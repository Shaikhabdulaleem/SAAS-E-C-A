import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { ArrowLeft, Plus, Mail, X, Send, Eye, MessageSquare, AlertTriangle, Clock, CheckCircle, Play, Pause, Trash2, Target, Users, BarChart2, ThumbsUp, ChevronDown, Pencil, TestTube } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Progress } from '../../components/ui/progress';
import { Separator } from '../../components/ui/separator';
import { Switch } from '../../components/ui/switch';
import { apiRequest } from '../../lib/api';

interface CampaignStep {
  id: string;
  stepNumber: number;
  subject: string;
  body: string;
  delayDays: number;
  useThreading: boolean;
  sentCount: number;
  openCount: number;
  replyCount: number;
  bounceCount: number;
}

interface CampaignMailbox {
  id: string;
  email: string;
  fromName: string;
  status: string;
}

interface CampaignAnalytics {
  steps: {
    stepNumber: number;
    sent: number;
    opens: number;
    replies: number;
    bounces: number;
  }[];
}

interface ColdCampaignFull {
  id: string;
  name: string;
  goal: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'error';
  prospectCount: number;
  sentCount: number;
  openCount: number;
  replyCount: number;
  bounceCount: number;
  positiveReplyCount: number;
  steps: CampaignStep[];
  mailboxes: CampaignMailbox[];
  createdAt: string;
}

const statusConfig: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground', icon: Clock },
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700', icon: Play },
  paused: { label: 'Paused', className: 'bg-amber-50 text-amber-700', icon: Pause },
  completed: { label: 'Completed', className: 'bg-sky-50 text-sky-700', icon: CheckCircle },
  error: { label: 'Error', className: 'bg-red-50 text-red-700', icon: AlertTriangle },
};

const defaultStepForm = {
  subject: '',
  body: '',
  delayDays: 3,
  useThreading: true,
};

export function ColdCampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<ColdCampaignFull | null>(null);
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showStepModal, setShowStepModal] = useState(false);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [stepForm, setStepForm] = useState({ ...defaultStepForm });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showTestSend, setShowTestSend] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [showAiWriter, setShowAiWriter] = useState(false);
  const [aiProduct, setAiProduct] = useState('');
  const [aiAudience, setAiAudience] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; category: string; steps: any[] }>>([]);
  const [testSending, setTestSending] = useState(false);
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => { fetchData(); }, [id]);

  const fetchData = async () => {
    try {
      const [campaignData, analyticsData] = await Promise.all([
        apiRequest<ColdCampaignFull>(`/cold-email/campaigns/${id}`),
        apiRequest<CampaignAnalytics>(`/cold-email/campaigns/${id}/analytics`),
      ]);
      setCampaign(campaignData);
      setAnalytics(analyticsData);
    } catch {} finally {
      setLoading(false);
    }
  };

  const setStep = (field: string, value: string | number | boolean) => {
    setStepForm(f => ({ ...f, [field]: value }));
    setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  };

  const insertVariable = (variable: string) => {
    setStepForm(f => ({ ...f, body: f.body + variable }));
  };

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!stepForm.body.trim()) errs.body = 'Email body is required';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    if (editingStepIndex !== null && campaign) {
      const updatedSteps = campaign.steps.map((s, i) =>
        i === editingStepIndex
          ? { ...stepForm, stepOrder: i }
          : { subject: s.subject, body: s.body, delayDays: s.delayDays, useThreading: s.useThreading, stepOrder: i }
      );
      try {
        const updated = await apiRequest<ColdCampaignFull>(`/cold-email/campaigns/${id}/steps`, {
          method: 'POST',
          body: JSON.stringify({ steps: updatedSteps }),
        });
        setCampaign(updated);
        setShowStepModal(false);
        setEditingStepIndex(null);
        setStepForm({ ...defaultStepForm });
        setErrors({});
      } catch {}
      return;
    }

    try {
      const updated = await apiRequest<ColdCampaignFull>(`/cold-email/campaigns/${id}/steps`, {
        method: 'POST',
        body: JSON.stringify(stepForm),
      });
      setCampaign(updated);
      setShowStepModal(false);
      setStepForm({ ...defaultStepForm });
      setErrors({});
    } catch {}
  };

  const handleEditStep = (index: number) => {
    if (!campaign) return;
    const step = campaign.steps[index];
    setStepForm({ subject: step.subject, body: step.body, delayDays: step.delayDays, useThreading: step.useThreading });
    setEditingStepIndex(index);
    setShowStepModal(true);
  };

  const handleDeleteStep = async (index: number) => {
    if (!campaign || !window.confirm('Delete this step?')) return;
    const remaining = campaign.steps.filter((_, i) => i !== index).map((s, i) => ({
      subject: s.subject, body: s.body, delayDays: s.delayDays, useThreading: s.useThreading, stepOrder: i,
    }));
    try {
      const updated = await apiRequest<ColdCampaignFull>(`/cold-email/campaigns/${id}/steps`, {
        method: 'POST',
        body: JSON.stringify({ steps: remaining }),
      });
      setCampaign(updated);
    } catch {}
  };

  const handleTestSend = async () => {
    if (!testEmail.trim()) return;
    setTestSending(true);
    setTestMessage('');
    try {
      await apiRequest(`/cold-email/campaigns/${id}/test-send`, {
        method: 'POST',
        body: JSON.stringify({ email: testEmail }),
      });
      setTestMessage('Test email sent!');
      setTimeout(() => { setShowTestSend(false); setTestMessage(''); }, 2000);
    } catch (err) {
      setTestMessage(err instanceof Error ? err.message : 'Failed to send test');
    } finally {
      setTestSending(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiProduct.trim()) return;
    setAiGenerating(true);
    try {
      const result = await apiRequest<{ content: string }>('/ai/generate-email', {
        method: 'POST', body: JSON.stringify({ prompt: `Write a 3-step cold email sequence for: Product: ${aiProduct}. Target: ${aiAudience || 'business decision makers'}. Keep each email under 100 words. Format as Step 1/2/3 with subject lines.` }),
      });
      const content = result.content ?? '';
      const stepMatches = content.split(/step\s*\d/i).filter(Boolean);
      if (stepMatches.length > 0 && campaign) {
        const newSteps = stepMatches.map((text, i) => {
          const subjectMatch = text.match(/subject[:\s]*(.+?)[\n\r]/i);
          const body = text.replace(/subject[:\s]*.+?[\n\r]/i, '').trim();
          return { subject: subjectMatch?.[1]?.trim() ?? `Follow-up ${i + 1}`, body, delayDays: i === 0 ? 0 : 3, useThreading: i > 0, stepOrder: i };
        });
        await apiRequest(`/cold-email/campaigns/${id}/steps`, { method: 'POST', body: JSON.stringify({ steps: newSteps }) });
        await fetchData();
      }
      setShowAiWriter(false); setAiProduct(''); setAiAudience('');
    } catch {} finally { setAiGenerating(false); }
  };

  const handleLoadTemplate = async (template: any) => {
    if (!campaign || !Array.isArray(template.steps)) return;
    const steps = template.steps.map((s: any, i: number) => ({ ...s, stepOrder: i }));
    await apiRequest(`/cold-email/campaigns/${id}/steps`, { method: 'POST', body: JSON.stringify({ steps }) });
    await fetchData();
    setShowTemplatePicker(false);
  };

  const handleSaveAsTemplate = async () => {
    if (!campaign?.steps?.length) return;
    const name = window.prompt('Template name:');
    if (!name) return;
    await apiRequest('/cold-email/sequence-templates', {
      method: 'POST', body: JSON.stringify({ name, steps: campaign.steps.map(s => ({ subject: s.subject, body: s.body, delayDays: s.delayDays, useThreading: s.useThreading })) }),
    });
  };

  const loadTemplates = async () => {
    const data = await apiRequest<any[]>('/cold-email/sequence-templates').catch(() => []);
    setTemplates(Array.isArray(data) ? data : []);
    setShowTemplatePicker(true);
  };

  const handleActivate = async () => {
    try {
      const updated = await apiRequest<ColdCampaignFull>(`/cold-email/campaigns/${id}/activate`, { method: 'POST' });
      setCampaign(updated);
    } catch {}
  };

  const handlePause = async () => {
    try {
      const updated = await apiRequest<ColdCampaignFull>(`/cold-email/campaigns/${id}/pause`, { method: 'POST' });
      setCampaign(updated);
    } catch {}
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this campaign? This action cannot be undone.')) return;
    try {
      await apiRequest(`/cold-email/campaigns/${id}`, { method: 'DELETE' });
      window.location.href = '/cold-email/campaigns';
    } catch {}
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-16 text-center">
        <p className="text-sm text-muted-foreground">Loading campaign...</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="max-w-7xl mx-auto py-16 text-center">
        <p className="text-sm text-muted-foreground">Campaign not found</p>
        <Button size="sm" className="mt-4" asChild>
          <Link to="/cold-email/campaigns">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Campaigns
          </Link>
        </Button>
      </div>
    );
  }

  const cfg = statusConfig[campaign.status];
  const StatusIcon = cfg.icon;
  const openRate = campaign.sentCount > 0 ? (campaign.openCount / campaign.sentCount) * 100 : 0;
  const replyRate = campaign.sentCount > 0 ? (campaign.replyCount / campaign.sentCount) * 100 : 0;
  const bounceRate = campaign.sentCount > 0 ? (campaign.bounceCount / campaign.sentCount) * 100 : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {showStepModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowStepModal(false)} />
          <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-lg border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background rounded-t-2xl z-10">
              <div>
                <h2 className="text-base font-semibold text-foreground">{editingStepIndex !== null ? 'Edit Step' : 'Add Step'}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{editingStepIndex !== null ? `Editing step ${editingStepIndex + 1}` : `Step ${(campaign.steps?.length ?? 0) + 1} in the sequence`}</p>
              </div>
              <button onClick={() => setShowStepModal(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddStep} className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="step-subject" className="text-sm">Subject</Label>
                <Input id="step-subject" placeholder="Leave empty for follow-ups using threading" value={stepForm.subject} onChange={e => setStep('subject', e.target.value)} />
                <p className="text-xs text-muted-foreground">Optional for follow-up steps with threading enabled</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="step-body" className="text-sm">Body</Label>
                <textarea id="step-body" rows={8} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" placeholder="Write your email body here..." value={stepForm.body} onChange={e => setStep('body', e.target.value)} />
                {errors.body && <p className="text-xs text-destructive">{errors.body}</p>}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {['{{first_name}}', '{{last_name}}', '{{company}}', '{{job_title}}'].map(v => (
                    <button key={v} type="button" onClick={() => insertVariable(v)} className="px-2 py-1 text-xs rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors">
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="step-delay" className="text-sm">Delay (days)</Label>
                  <Input id="step-delay" type="number" min={0} value={stepForm.delayDays} onChange={e => setStep('delayDays', parseInt(e.target.value) || 0)} />
                </div>
                <div className="flex items-center justify-between pt-6">
                  <Label className="text-sm">Use Threading</Label>
                  <Switch checked={stepForm.useThreading} onCheckedChange={v => setStep('useThreading', v)} />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border mt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowStepModal(false)}>Cancel</Button>
                <Button type="submit" size="sm">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  {editingStepIndex !== null ? 'Save Changes' : 'Add Step'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAiWriter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAiWriter(false)} />
          <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-md border border-border">
            <div className="px-6 py-4 border-b"><h2 className="text-base font-semibold">AI Email Writer</h2><p className="text-xs text-muted-foreground mt-0.5">Describe your product and audience to auto-generate a sequence</p></div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5"><label className="text-sm font-medium">What do you sell? *</label><textarea rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="We help B2B companies automate their outreach and book more meetings..." value={aiProduct} onChange={e => setAiProduct(e.target.value)} /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium">Target audience</label><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="SaaS founders, VP Sales, marketing directors..." value={aiAudience} onChange={e => setAiAudience(e.target.value)} /></div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => setShowAiWriter(false)}>Cancel</Button>
                <Button size="sm" onClick={() => void handleAiGenerate()} disabled={aiGenerating || !aiProduct.trim()}>{aiGenerating ? 'Generating...' : 'Generate 3-Step Sequence'}</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTemplatePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowTemplatePicker(false)} />
          <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-md border border-border max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-4 border-b"><h2 className="text-base font-semibold">Load Template</h2></div>
            <div className="px-6 py-4 space-y-2">
              {templates.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No templates saved yet</p> : templates.map(t => (
                <button key={t.id} onClick={() => void handleLoadTemplate(t)} className="w-full text-left p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors">
                  <p className="font-medium text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.category} — {t.steps?.length ?? 0} steps</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/cold-email/campaigns">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50">
            <Mail className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-foreground">{campaign.name}</h1>
              <Badge variant="secondary" className={`text-xs h-5 ${cfg.className} gap-1`}>
                <StatusIcon className="h-3 w-3" />
                {cfg.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
              <Target className="h-3.5 w-3.5" />
              {campaign.goal.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === 'active' ? (
            <Button variant="outline" size="sm" onClick={handlePause}>
              <Pause className="h-4 w-4 mr-1.5" />
              Pause
            </Button>
          ) : campaign.status !== 'completed' ? (
            <Button size="sm" onClick={handleActivate}>
              <Play className="h-4 w-4 mr-1.5" />
              Activate
            </Button>
          ) : null}
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Prospects', value: campaign.prospectCount.toLocaleString(), icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Emails Sent', value: campaign.sentCount.toLocaleString(), icon: Send, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Open Rate', value: `${openRate.toFixed(1)}%`, icon: Eye, color: 'text-sky-600', bg: 'bg-sky-50' },
          { label: 'Reply Rate', value: `${replyRate.toFixed(1)}%`, icon: MessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Positive Replies', value: campaign.positiveReplyCount.toLocaleString(), icon: ThumbsUp, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Bounce Rate', value: `${bounceRate.toFixed(1)}%`, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Sequence Steps</CardTitle>
                  <CardDescription>{campaign.steps?.length ?? 0} steps in this sequence</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void loadTemplates()}>Templates</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAiWriter(true)}>AI Write</Button>
                  {campaign.steps?.length > 0 && <Button size="sm" variant="outline" onClick={() => void handleSaveAsTemplate()}>Save Template</Button>}
                  <Button size="sm" onClick={() => setShowStepModal(true)}>
                    <Plus className="h-4 w-4 mr-1.5" />Add Step
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {campaign.steps && campaign.steps.length > 0 ? (
                campaign.steps.map((step, index) => (
                  <div key={step.id}>
                    {index > 0 && (
                      <div className="flex items-center gap-2 py-2 px-4">
                        <div className="h-6 border-l-2 border-dashed border-muted-foreground/30 ml-4" />
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Wait {step.delayDays} day{step.delayDays !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    <div className="rounded-lg border border-border p-4 hover:shadow-sm transition-all">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-indigo-50 shrink-0">
                          <span className="text-xs font-bold text-indigo-600">{step.stepNumber}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-foreground">
                                {step.subject || (step.useThreading ? 'RE: threading' : 'Follow-up')}
                              </p>
                              {step.useThreading && (
                                <Badge variant="secondary" className="text-xs h-5 bg-sky-50 text-sky-700">Threaded</Badge>
                              )}
                            </div>
                            {campaign.status === 'draft' && (
                              <div className="flex gap-1">
                                <button type="button" onClick={() => handleEditStep(index)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                                <button type="button" onClick={() => void handleDeleteStep(index)} className="p-1 rounded hover:bg-muted text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{step.body}</p>
                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Send className="h-3 w-3" />
                              {step.sentCount} sent
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {step.openCount} opens
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {step.replyCount} replies
                            </span>
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {step.bounceCount} bounces
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center">
                  <Mail className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No steps yet. Add your first step to start building the sequence.</p>
                  <Button size="sm" className="mt-3" onClick={() => setShowStepModal(true)}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add First Step
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {analytics && analytics.steps.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Step-by-Step Analytics</CardTitle>
                <CardDescription>Performance breakdown by step</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Step</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Sent</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Opens</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Open Rate</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Replies</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Reply Rate</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Bounces</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.steps.map(step => {
                        const stepOpenRate = step.sent > 0 ? (step.opens / step.sent) * 100 : 0;
                        const stepReplyRate = step.sent > 0 ? (step.replies / step.sent) * 100 : 0;
                        return (
                          <tr key={step.stepNumber} className="border-b border-border last:border-0 hover:bg-muted/50">
                            <td className="px-4 py-3 font-medium text-foreground">Step {step.stepNumber}</td>
                            <td className="px-4 py-3 text-right text-foreground">{step.sent.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-foreground">{step.opens.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sky-600 font-medium">{stepOpenRate.toFixed(1)}%</span>
                            </td>
                            <td className="px-4 py-3 text-right text-foreground">{step.replies.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-emerald-600 font-medium">{stepReplyRate.toFixed(1)}%</span>
                            </td>
                            <td className="px-4 py-3 text-right text-red-600">{step.bounces.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Connected Mailboxes</CardTitle>
              <CardDescription>{campaign.mailboxes?.length ?? 0} mailboxes assigned</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {campaign.mailboxes && campaign.mailboxes.length > 0 ? (
                campaign.mailboxes.map(mb => (
                  <div key={mb.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border">
                    <div className="p-1.5 rounded-md bg-indigo-50">
                      <Mail className="h-3.5 w-3.5 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{mb.email}</p>
                      <p className="text-xs text-muted-foreground">{mb.fromName}</p>
                    </div>
                    <Badge variant="secondary" className={`text-xs h-5 ${mb.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                      {mb.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No mailboxes connected</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Campaign Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {campaign.steps?.length > 0 && (
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setShowTestSend(!showTestSend)}>
                  <TestTube className="h-4 w-4 mr-2" />
                  Send Test Email
                </Button>
              )}
              {showTestSend && (
                <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                  <Input placeholder="your@email.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="h-8 text-sm" />
                  <Button size="sm" className="w-full" onClick={() => void handleTestSend()} disabled={testSending}>
                    {testSending ? 'Sending...' : 'Send Test'}
                  </Button>
                  {testMessage && <p className="text-xs text-center text-emerald-600">{testMessage}</p>}
                </div>
              )}
              {campaign.status === 'draft' && (
                <div className="space-y-1.5 p-3 rounded-lg border bg-muted/20 mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pre-flight Checklist</p>
                  {[
                    { label: 'Steps configured', ok: (campaign.steps?.length ?? 0) > 0 },
                    { label: 'Mailboxes assigned', ok: (campaign.mailboxes?.length ?? 0) > 0 },
                    { label: 'Prospect list linked', ok: campaign.prospectCount > 0 },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2 text-xs">
                      {item.ok ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                      <span className={item.ok ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
                    </div>
                  ))}
                </div>
              )}
              {campaign.status === 'active' ? (
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={handlePause}>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause Campaign
                </Button>
              ) : campaign.status !== 'completed' ? (
                <Button size="sm" className="w-full justify-start" onClick={handleActivate}>
                  <Play className="h-4 w-4 mr-2" />
                  Activate Campaign
                </Button>
              ) : null}
              <Button variant="outline" size="sm" className="w-full justify-start text-destructive hover:text-destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Campaign
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}