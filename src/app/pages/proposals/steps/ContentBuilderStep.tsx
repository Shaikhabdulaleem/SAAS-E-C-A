import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { GripVertical } from 'lucide-react';
import {
  useProposalForm,
  type TermsItemData,
  type TimelineStepData,
  DEFAULT_TERMS_ITEMS,
  DEFAULT_TIMELINE_STEPS,
} from '../ProposalFormContext';

interface PresetOption {
  id: string;
  name: string;
  description?: string;
  style: string;
  aboutUsContent?: string;
  termsItems: TermsItemData[];
  timelineSteps: TimelineStepData[];
  isDefault: boolean;
}

const TEMPLATE_OPTIONS = [
  { id: 'modern', name: 'Modern', description: 'Bold gradients, cards, and vibrant colors' },
  { id: 'classic', name: 'Classic', description: 'Formal serif typography, structured layout' },
  { id: 'minimal', name: 'Minimal', description: 'Clean whitespace, monochrome palette' },
];

export function ContentBuilderStep() {
  const { state, setState, admin } = useProposalForm();
  const content = state.content;
  const [presets, setPresets] = useState<PresetOption[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('none');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const basePath = admin ? '/admin/proposals' : '/proposals';

  useEffect(() => {
    apiRequest<PresetOption[]>(`${basePath}/template-presets`)
      .then((data) => setPresets(Array.isArray(data) ? data : []))
      .catch(() => setPresets([]));
  }, [basePath]);

  const setIntro = (value: string) => {
    setState((prev) => ({ ...prev, content: { ...prev.content, introMessage: value } }));
  };

  const toggleSection = (key: string) => {
    setState((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        sections: prev.content.sections.map((s) =>
          s.sectionKey === key ? { ...s, isEnabled: !s.isEnabled } : s
        ),
      },
    }));
  };

  const updateSectionTitle = (key: string, title: string) => {
    setState((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        sections: prev.content.sections.map((s) =>
          s.sectionKey === key ? { ...s, sectionTitle: title } : s
        ),
      },
    }));
  };

  const updateSectionContent = (key: string, sectionContent: unknown) => {
    setState((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        sections: prev.content.sections.map((s) =>
          s.sectionKey === key ? { ...s, content: sectionContent } : s
        ),
      },
    }));
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    setState((prev) => {
      const sections = [...prev.content.sections];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= sections.length) return prev;
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...prev, content: { ...prev.content, sections: sections.map((s, i) => ({ ...s, sortOrder: i })) } };
    });
  };

  const applyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (presetId === 'none') return;
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    setState((prev) => ({
      ...prev,
      templateId: preset.style,
      content: {
        ...prev.content,
        sections: prev.content.sections.map((s) => {
          if (s.sectionKey === 'about_us') return { ...s, content: { text: preset.aboutUsContent ?? '' } };
          if (s.sectionKey === 'terms') return { ...s, content: { items: preset.termsItems?.length ? preset.termsItems : DEFAULT_TERMS_ITEMS } };
          if (s.sectionKey === 'timeline') return { ...s, content: { steps: preset.timelineSteps?.length ? preset.timelineSteps : DEFAULT_TIMELINE_STEPS } };
          return s;
        }),
      },
    }));
  };

  const getAboutUs = (): string => {
    const section = content.sections.find((s) => s.sectionKey === 'about_us');
    return (section?.content as { text?: string } | null)?.text ?? '';
  };

  const getTerms = (): TermsItemData[] => {
    const section = content.sections.find((s) => s.sectionKey === 'terms');
    const items = (section?.content as { items?: TermsItemData[] } | null)?.items;
    return items?.length ? items : DEFAULT_TERMS_ITEMS;
  };

  const getTimeline = (): TimelineStepData[] => {
    const section = content.sections.find((s) => s.sectionKey === 'timeline');
    const steps = (section?.content as { steps?: TimelineStepData[] } | null)?.steps;
    return steps?.length ? steps : DEFAULT_TIMELINE_STEPS;
  };

  const variableTags = ['{{customer_name}}', '{{company_name}}', '{{total_price}}', '{{billing_cycle}}', '{{valid_until}}'];
  const editableSections = new Set(['about_us', 'terms', 'timeline']);

  return (
    <div className="space-y-4">
      {/* PDF Template Style */}
      <Card>
        <CardHeader><CardTitle className="text-base">PDF Template Style</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Choose a visual style for your proposal PDF.</p>
          <div className="grid grid-cols-3 gap-4">
            {TEMPLATE_OPTIONS.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setState((prev) => ({ ...prev, templateId: tpl.id }))}
                className={`relative rounded-lg border-2 p-3 text-left transition-all ${
                  state.templateId === tpl.id
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                {tpl.id === 'modern' && (
                  <div className="h-28 rounded mb-3 bg-gradient-to-br from-blue-50 to-purple-50 border p-3 space-y-2">
                    <div className="h-3 w-16 rounded-full bg-blue-500" />
                    <div className="h-2 w-24 rounded bg-gray-200" />
                    <div className="grid grid-cols-2 gap-1 mt-2"><div className="h-5 rounded bg-blue-100" /><div className="h-5 rounded bg-purple-100" /></div>
                    <div className="h-3 w-full rounded bg-blue-500/20 mt-1" />
                  </div>
                )}
                {tpl.id === 'classic' && (
                  <div className="h-28 rounded mb-3 bg-amber-50/50 border p-3 space-y-2">
                    <div className="h-0.5 w-full bg-amber-700" />
                    <div className="h-3 w-20 rounded-sm bg-gray-800" />
                    <div className="h-2 w-28 rounded-sm bg-gray-300" />
                    <div className="space-y-1 mt-2"><div className="h-3 w-full border-b border-gray-200" /><div className="h-3 w-full border-b border-gray-200" /><div className="h-3 w-full border-b border-gray-200" /></div>
                  </div>
                )}
                {tpl.id === 'minimal' && (
                  <div className="h-28 rounded mb-3 bg-white border p-4 space-y-2">
                    <div className="h-2 w-12 bg-black" />
                    <div className="h-3 w-20 bg-gray-900 rounded-sm" />
                    <div className="h-1.5 w-full bg-gray-100 mt-3" />
                    <div className="h-1.5 w-3/4 bg-gray-100" />
                    <div className="h-px w-full bg-gray-200 mt-2" />
                  </div>
                )}
                <p className="font-semibold text-sm">{tpl.name}</p>
                <p className="text-xs text-muted-foreground">{tpl.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Template Preset */}
      {presets.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Template Preset</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Load a saved template to pre-fill About Us, Terms, and Timeline content.</p>
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label>Select Preset</Label>
                <Select value={selectedPresetId} onValueChange={applyPreset}>
                  <SelectTrigger><SelectValue placeholder="Choose a preset..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (custom)</SelectItem>
                    {presets.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}{p.isDefault ? ' (default)' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <a href={admin ? '/mcc/settings/proposal-templates' : '/settings/proposal-templates'} className="inline-flex items-center gap-1 text-xs text-primary hover:underline pb-2">
                Manage <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Introduction Message */}
      <Card>
        <CardHeader><CardTitle className="text-base">Introduction Message</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {variableTags.map((tag) => (
              <button key={tag} type="button" onClick={() => setIntro(content.introMessage + ' ' + tag)} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted/80">{tag}</button>
            ))}
          </div>
          <Textarea rows={4} placeholder="Write a personalized introduction for this proposal..." value={content.introMessage} onChange={(e) => setIntro(e.target.value)} />
          <p className="text-xs text-muted-foreground">Use variable tags to personalize the message. They will be replaced with actual values in the PDF.</p>
        </CardContent>
      </Card>

      {/* PDF Sections */}
      <Card>
        <CardHeader><CardTitle className="text-base">PDF Sections</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Toggle sections on or off, reorder them, and customize content.</p>
          <div className="space-y-2">
            {content.sections.map((section, index) => (
              <div key={section.sectionKey} className="space-y-0">
                <div className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${section.isEnabled ? 'bg-white border-border' : 'bg-muted/30 border-dashed'}`}>
                  <div className="flex flex-col gap-0.5">
                    <button type="button" onClick={() => moveSection(index, 'up')} disabled={index === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs">▲</button>
                    <button type="button" onClick={() => moveSection(index, 'down')} disabled={index === content.sections.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs">▼</button>
                  </div>
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <button type="button" onClick={() => toggleSection(section.sectionKey)} className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${section.isEnabled ? 'bg-primary border-primary text-white' : 'border-muted-foreground/30'}`}>
                    {section.isEnabled && <span className="text-xs">✓</span>}
                  </button>
                  <Input value={section.sectionTitle} onChange={(e) => updateSectionTitle(section.sectionKey, e.target.value)} className={`flex-1 h-8 text-sm ${!section.isEnabled ? 'opacity-50' : ''}`} disabled={!section.isEnabled} />
                  {editableSections.has(section.sectionKey) && section.isEnabled && (
                    <button type="button" onClick={() => setExpandedSection(expandedSection === section.sectionKey ? null : section.sectionKey)} className="text-xs text-primary hover:underline shrink-0">
                      {expandedSection === section.sectionKey ? 'Close' : 'Edit'}
                    </button>
                  )}
                  <span className="text-xs text-muted-foreground font-mono shrink-0">{section.sectionKey}</span>
                </div>

                {/* About Us Editor */}
                {expandedSection === 'about_us' && section.sectionKey === 'about_us' && section.isEnabled && (
                  <div className="ml-12 mr-4 mt-1 p-3 rounded-b-lg border border-t-0 bg-muted/10 space-y-2">
                    <Label className="text-xs">About Us Content</Label>
                    <Textarea rows={4} placeholder="Enter your About Us text... Leave empty to use brand settings default." value={getAboutUs()} onChange={(e) => updateSectionContent('about_us', { text: e.target.value })} />
                  </div>
                )}

                {/* Terms Editor */}
                {expandedSection === 'terms' && section.sectionKey === 'terms' && section.isEnabled && (
                  <div className="ml-12 mr-4 mt-1 p-3 rounded-b-lg border border-t-0 bg-muted/10 space-y-3">
                    <Label className="text-xs">Terms & Conditions Items</Label>
                    {getTerms().map((term, ti) => (
                      <div key={ti} className="flex gap-2 items-start">
                        <div className="flex flex-col gap-0.5 mt-1">
                          <button type="button" disabled={ti === 0} onClick={() => { const items = [...getTerms()]; [items[ti - 1], items[ti]] = [items[ti], items[ti - 1]]; updateSectionContent('terms', { items }); }} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-[10px]">▲</button>
                          <button type="button" disabled={ti === getTerms().length - 1} onClick={() => { const items = [...getTerms()]; [items[ti], items[ti + 1]] = [items[ti + 1], items[ti]]; updateSectionContent('terms', { items }); }} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-[10px]">▼</button>
                        </div>
                        <Input className="w-32 h-7 text-xs" placeholder="Title" value={term.title} onChange={(e) => { const items = [...getTerms()]; items[ti] = { ...items[ti], title: e.target.value }; updateSectionContent('terms', { items }); }} />
                        <Input className="flex-1 h-7 text-xs" placeholder="Description" value={term.text} onChange={(e) => { const items = [...getTerms()]; items[ti] = { ...items[ti], text: e.target.value }; updateSectionContent('terms', { items }); }} />
                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => { const items = getTerms().filter((_, i) => i !== ti); updateSectionContent('terms', { items }); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => { updateSectionContent('terms', { items: [...getTerms(), { title: '', text: '' }] }); }}>
                      <Plus className="h-3 w-3 mr-1" />Add Term
                    </Button>
                  </div>
                )}

                {/* Timeline Editor */}
                {expandedSection === 'timeline' && section.sectionKey === 'timeline' && section.isEnabled && (
                  <div className="ml-12 mr-4 mt-1 p-3 rounded-b-lg border border-t-0 bg-muted/10 space-y-3">
                    <Label className="text-xs">Implementation Timeline Steps</Label>
                    {getTimeline().map((step, si) => (
                      <div key={si} className="flex gap-2 items-start">
                        <div className="flex flex-col gap-0.5 mt-1">
                          <button type="button" disabled={si === 0} onClick={() => { const steps = [...getTimeline()]; [steps[si - 1], steps[si]] = [steps[si], steps[si - 1]]; updateSectionContent('timeline', { steps }); }} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-[10px]">▲</button>
                          <button type="button" disabled={si === getTimeline().length - 1} onClick={() => { const steps = [...getTimeline()]; [steps[si], steps[si + 1]] = [steps[si + 1], steps[si]]; updateSectionContent('timeline', { steps }); }} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-[10px]">▼</button>
                        </div>
                        <Input className="w-48 h-7 text-xs" placeholder="Step title" value={step.title} onChange={(e) => { const steps = [...getTimeline()]; steps[si] = { ...steps[si], title: e.target.value }; updateSectionContent('timeline', { steps }); }} />
                        <Input className="flex-1 h-7 text-xs" placeholder="Description" value={step.description} onChange={(e) => { const steps = [...getTimeline()]; steps[si] = { ...steps[si], description: e.target.value }; updateSectionContent('timeline', { steps }); }} />
                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => { const steps = getTimeline().filter((_, i) => i !== si); updateSectionContent('timeline', { steps }); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => { updateSectionContent('timeline', { steps: [...getTimeline(), { title: '', description: '' }] }); }}>
                      <Plus className="h-3 w-3 mr-1" />Add Step
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
