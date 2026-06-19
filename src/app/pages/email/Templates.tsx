import { useState } from 'react';
import { Plus, FileText, Eye, Copy, Search, Sparkles, LayoutTemplate, Star, X, Check, Mail } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useData, type EmailTemplate } from '../../contexts/DataContext';
import { apiRequest } from '../../lib/api';

const templates = [
  {
    id: '1', name: 'Product Launch', category: 'promotional',
    description: 'Announce new products or features with a compelling layout.',
    usageCount: 124, rating: 4.8,
    subject: 'Introducing Our New Features',
    previewLines: [
      { type: 'header', text: '🚀 Introducing Our Latest Feature' },
      { type: 'hero', text: '' },
      { type: 'body', text: 'We\'re thrilled to announce our newest feature that will transform the way you work...' },
      { type: 'body', text: 'Here\'s what\'s included in this update:' },
      { type: 'list', text: '✅ Feature one — description' },
      { type: 'list', text: '✅ Feature two — description' },
      { type: 'cta', text: 'Learn More →' },
    ],
    colors: ['bg-indigo-500', 'bg-indigo-400', 'bg-indigo-200'],
  },
  {
    id: '2', name: 'Monthly Newsletter', category: 'newsletter',
    description: 'Regular update template with multiple content sections.',
    usageCount: 89, rating: 4.6,
    subject: 'Your Monthly Sales Insights — June 2026',
    previewLines: [
      { type: 'header', text: '📰 Monthly Digest — June 2026' },
      { type: 'section', text: 'This Month\'s Highlights' },
      { type: 'body', text: 'Here\'s a roundup of everything that happened this month...' },
      { type: 'section', text: 'Industry News' },
      { type: 'body', text: 'Key trends and updates from the industry...' },
      { type: 'footer', text: 'Unsubscribe · View in browser' },
    ],
    colors: ['bg-violet-500', 'bg-violet-400', 'bg-violet-200'],
  },
  {
    id: '3', name: 'Welcome Series', category: 'welcome',
    description: 'Warm onboarding email for new subscribers or customers.',
    usageCount: 211, rating: 4.9,
    subject: 'Welcome to NexusHQ — Let\'s get started!',
    previewLines: [
      { type: 'header', text: '👋 Welcome to NexusHQ!' },
      { type: 'body', text: 'We\'re so excited to have you on board. Here\'s how to get started in 3 steps:' },
      { type: 'list', text: '1️⃣ Set up your profile' },
      { type: 'list', text: '2️⃣ Import your contacts' },
      { type: 'list', text: '3️⃣ Create your first campaign' },
      { type: 'cta', text: 'Get Started →' },
    ],
    colors: ['bg-emerald-500', 'bg-emerald-400', 'bg-emerald-200'],
  },
  {
    id: '4', name: 'Event Invitation', category: 'promotional',
    description: 'Invite contacts to webinars, workshops, or live events.',
    usageCount: 56, rating: 4.5,
    subject: 'You\'re Invited — Join Our Upcoming Webinar',
    previewLines: [
      { type: 'header', text: '🎯 You\'re Invited!' },
      { type: 'hero', text: '' },
      { type: 'body', text: 'Join us for an exclusive webinar on growth strategies for 2026.' },
      { type: 'list', text: '📅 Date: July 15, 2026' },
      { type: 'list', text: '🕐 Time: 2:00 PM EST' },
      { type: 'cta', text: 'Register Now →' },
    ],
    colors: ['bg-sky-500', 'bg-sky-400', 'bg-sky-200'],
  },
  {
    id: '5', name: 'Follow-up Email', category: 'follow_up',
    description: 'Re-engage contacts after meetings, demos, or proposals.',
    usageCount: 178, rating: 4.7,
    subject: 'Following Up on Our Conversation',
    previewLines: [
      { type: 'header', text: '💬 Following Up on Our Call' },
      { type: 'body', text: 'Hi [First Name], it was great speaking with you today.' },
      { type: 'body', text: 'As discussed, here are the key takeaways and next steps:' },
      { type: 'list', text: '→ Next step one' },
      { type: 'list', text: '→ Next step two' },
      { type: 'cta', text: 'Schedule a Demo →' },
    ],
    colors: ['bg-amber-500', 'bg-amber-400', 'bg-amber-200'],
  },
  {
    id: '6', name: 'Sales Outreach', category: 'promotional',
    description: 'Cold outreach template optimized for B2B prospecting.',
    usageCount: 92, rating: 4.4,
    subject: 'Quick Question for [Company Name]',
    previewLines: [
      { type: 'header', text: '🤝 Quick Question for You' },
      { type: 'body', text: 'Hi [First Name], I noticed [Company Name] has been growing fast...' },
      { type: 'body', text: 'We help companies like yours [value proposition].' },
      { type: 'list', text: '✓ Benefit one' },
      { type: 'list', text: '✓ Benefit two' },
      { type: 'cta', text: 'Book 15 Min Call →' },
    ],
    colors: ['bg-rose-500', 'bg-rose-400', 'bg-rose-200'],
  },
];

const categoryConfig: Record<string, { label: string; className: string }> = {
  promotional: { label: 'Promotional', className: 'bg-indigo-50 text-indigo-700' },
  newsletter: { label: 'Newsletter', className: 'bg-violet-50 text-violet-700' },
  welcome: { label: 'Welcome', className: 'bg-emerald-50 text-emerald-700' },
  follow_up: { label: 'Follow-up', className: 'bg-amber-50 text-amber-700' },
};

type Template = typeof templates[0];

function PreviewModal({ template, onClose, onUse }: { template: Template; onClose: () => void; onUse: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">{template.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* Email frame */}
          <div className="border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="bg-muted/40 px-4 py-2.5 border-b border-border flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <div className="flex-1 mx-3 bg-muted rounded px-3 py-1 text-[10px] text-muted-foreground truncate">
                {template.subject}
              </div>
            </div>
            <div className="bg-white p-6 space-y-3">
              {template.previewLines.map((line, i) => (
                <div key={i}>
                  {line.type === 'header' && (
                    <div className={`px-4 py-3 rounded-lg ${template.colors[0]} text-white text-sm font-semibold`}>
                      {line.text}
                    </div>
                  )}
                  {line.type === 'hero' && (
                    <div className={`h-24 rounded-lg ${template.colors[1]} opacity-50 flex items-center justify-center text-white text-xs`}>
                      [Hero Image]
                    </div>
                  )}
                  {line.type === 'body' && (
                    <p className="text-sm text-gray-700 leading-relaxed">{line.text}</p>
                  )}
                  {line.type === 'list' && (
                    <p className="text-sm text-gray-700 pl-2">{line.text}</p>
                  )}
                  {line.type === 'section' && (
                    <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-1">{line.text}</h3>
                  )}
                  {line.type === 'cta' && (
                    <div className={`px-4 py-2.5 rounded-lg ${template.colors[0]} text-white text-sm font-medium text-center`}>
                      {line.text}
                    </div>
                  )}
                  {line.type === 'footer' && (
                    <p className="text-[11px] text-gray-400 text-center pt-2 border-t border-gray-100">{line.text}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          <Button size="sm" onClick={onUse}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Use This Template
          </Button>
        </div>
      </div>
    </div>
  );
}

function UseTemplateModal({ template, onClose }: { template: Template; onClose: () => void }) {
  const { addCampaign } = useData();
  const [name, setName] = useState(`${template.name} Campaign`);
  const [subject, setSubject] = useState(template.subject);
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [done, setDone] = useState(false);

  const handleCreate = () => {
    if (!name.trim() || !subject.trim()) return;
    addCampaign({ name, subject, fromName, fromEmail, status: 'draft', totalRecipients: 0, openCount: 0, clickCount: 0, bounceCount: 0, unsubCount: 0, trackOpens: true, trackClicks: true, gdprConsent: false, doubleOptIn: false });
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-md border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">Use Template</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Create a campaign from "{template.name}"</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="px-6 py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <Check className="h-6 w-6 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Campaign Created!</h3>
            <p className="text-sm text-muted-foreground mb-5">"{name}" has been saved as a draft.</p>
            <Button size="sm" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Campaign Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Campaign name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Subject Line</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Sender Name</Label>
                <Input value={fromName} onChange={e => setFromName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Sender Email</Label>
                <Input type="email" value={fromEmail} onChange={e => setFromEmail(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-border mt-2">
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={!name.trim() || !subject.trim()}>
                <Mail className="h-3.5 w-3.5 mr-1.5" />
                Create Draft
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateTemplateModal({ onClose, aiMode, onSave }: { onClose: () => void; aiMode?: boolean; onSave: (template: Omit<EmailTemplate, 'id' | 'createdAt'>) => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('promotional');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      let finalSubject = subject.trim();
      let finalBody = body.trim();
      if (aiMode) {
        const generated = await apiRequest<{ content: string }>('/ai/generate-email', {
          method: 'POST',
          body: JSON.stringify({ goal: body.trim() || name.trim() }),
        });
        finalBody = generated.content;
        finalSubject = finalSubject || generated.content.match(/^Subject:\s*(.+)$/m)?.[1] || name.trim();
      }
      if (!finalSubject) finalSubject = name.trim();
      if (!finalBody) finalBody = 'Write your reusable email content here.';
      onSave({ name: name.trim(), subject: finalSubject, body: finalBody, category });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-lg border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {aiMode ? 'Generate with AI' : 'Create Template'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {aiMode ? 'AI will generate a template based on your goal' : 'Build a reusable email template'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="px-6 py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <Check className="h-6 w-6 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Template Saved!</h3>
            <p className="text-sm text-muted-foreground mb-5">"{name}" has been added to your templates.</p>
            <Button size="sm" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Template Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q4 Outreach" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Category</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(categoryConfig).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => setCategory(k)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${category === k ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Default Subject Line</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject line" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{aiMode ? 'Campaign Goal' : 'Template Content'}</Label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder={aiMode ? 'Describe what you want the AI to write...' : 'Write your email template content here...'}
                className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[100px]"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-border mt-2">
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={!name.trim() || saving}>
                {aiMode ? <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Generate & Save</> : <><FileText className="h-3.5 w-3.5 mr-1.5" />Save Template</>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Templates() {
  const { templates: savedTemplates, addTemplate, deleteTemplate, apiError } = useData();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [useTemplate, setUseTemplate] = useState<Template | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAI, setShowAI] = useState(false);

  const displayedTemplates: Template[] = savedTemplates.map((template, index) => {
    const base = templates[index % templates.length];
    return {
      ...base,
      id: template.id,
      name: template.name,
      subject: template.subject,
      category: template.category || 'promotional',
      description: template.body,
      usageCount: base.usageCount,
      rating: base.rating,
      previewLines: [
        { type: 'header', text: template.subject },
        { type: 'body', text: template.body.slice(0, 120) },
        { type: 'cta', text: 'Learn More' },
      ],
    };
  });

  const filtered = displayedTemplates.filter(t =>
    (category === 'all' || t.category === category) &&
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {apiError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {apiError}
        </div>
      )}

      {/* Modals */}
      {previewTemplate && (
        <PreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onUse={() => { setUseTemplate(previewTemplate); setPreviewTemplate(null); }}
        />
      )}
      {useTemplate && <UseTemplateModal template={useTemplate} onClose={() => setUseTemplate(null)} />}
      {showCreate && <CreateTemplateModal onClose={() => setShowCreate(false)} onSave={addTemplate} />}
      {showAI && <CreateTemplateModal onClose={() => setShowAI(false)} aiMode onSave={addTemplate} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-foreground">Email Templates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Pre-built templates to accelerate your campaigns</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Create Template
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Templates', value: displayedTemplates.length, icon: LayoutTemplate, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Most Used', value: Math.max(...displayedTemplates.map(t => t.usageCount), 0), icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Avg Rating', value: displayedTemplates.length ? (displayedTemplates.reduce((s, t) => s + t.rating, 0) / displayedTemplates.length).toFixed(1) : '0.0', icon: Sparkles, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(stat => (
          <Card key={stat.label} className="p-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-semibold text-foreground">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 bg-muted/50"
          />
        </div>
        <Tabs value={category} onValueChange={setCategory}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="promotional" className="text-xs">Promo</TabsTrigger>
            <TabsTrigger value="newsletter" className="text-xs">Newsletter</TabsTrigger>
            <TabsTrigger value="welcome" className="text-xs">Welcome</TabsTrigger>
            <TabsTrigger value="follow_up" className="text-xs">Follow-up</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((template) => (
          <Card key={template.id} className="group overflow-hidden hover:shadow-md transition-all hover:border-primary/20 p-0">
            {/* Visual Preview */}
            <div className="relative h-44 bg-muted/30 border-b border-border overflow-hidden">
              <div className="absolute inset-0 flex flex-col p-3 gap-1.5 scale-90 origin-top">
                {template.previewLines.map((line, i) => (
                  <div key={i} className={`rounded px-2 py-1 ${
                    line.type === 'header' ? `${template.colors[0]} text-white text-[10px] font-medium` :
                    line.type === 'hero' ? `${template.colors[1]} opacity-60 h-6` :
                    line.type === 'cta' ? `${template.colors[0]} text-white text-[9px] text-center py-1.5 font-medium` :
                    line.type === 'section' ? 'bg-muted text-[9px] text-muted-foreground font-medium' :
                    'bg-muted/70 text-[9px] text-muted-foreground'
                  }`}>
                    {line.type !== 'hero' && line.text}
                  </div>
                ))}
              </div>
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => setPreviewTemplate(template)}>
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </Button>
                <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setUseTemplate(template)}>
                  <Copy className="h-3.5 w-3.5" />
                  Use
                </Button>
              </div>
            </div>

            {/* Template info */}
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-semibold text-foreground">{template.name}</h3>
                <Badge variant="secondary" className={`text-[10px] h-4 px-1.5 ${categoryConfig[template.category]?.className}`}>
                  {categoryConfig[template.category]?.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{template.description}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                  {template.rating}
                </span>
                <button className="hover:text-destructive" onClick={() => {
                  if (window.confirm(`Delete ${template.name}?`)) deleteTemplate(template.id);
                }}>Delete</button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create CTA */}
      <Card className="p-0 overflow-hidden">
        <div className="relative bg-gradient-to-br from-indigo-50 via-violet-50 to-sky-50 p-8 text-center">
          <div className="relative">
            <div className="inline-flex p-3 rounded-xl bg-indigo-100 mb-4">
              <Sparkles className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-2">Need something custom?</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
              Build your own template from scratch or ask the AI Assistant to generate one based on your campaign goals.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Blank Template
              </Button>
              <Button size="sm" onClick={() => setShowAI(true)}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Generate with AI
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
