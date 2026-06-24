import { useEffect, useMemo, useState } from 'react';
import { useData, type Campaign, type EmailAbVariant, type EmailContentBlock } from '../../contexts/DataContext';
import { Link } from 'react-router';
import { Plus, Mail, Eye, MousePointerClick, Send, Clock, CheckCircle, BarChart2, MoreHorizontal, X, ShieldCheck, Users, Upload, Globe, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Separator } from '../../components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Textarea } from '../../components/ui/textarea';
import { apiRequest } from '../../lib/api';
import { blocksToHtml, defaultEmailBlocks, EmailContentBuilder } from './EmailContentBuilder';

type DomainSummary = {
  id: string;
  domain: string;
  spfStatus: string;
  dkimStatus: string;
  dmarcStatus: string;
  mxStatus: string;
};

type CampaignPreflight = {
  ready: boolean;
  fields: Record<string, string>;
  checklist: Array<{ key: string; label: string; passed: boolean; blocking: boolean }>;
  blockingErrors: string[];
  warnings: string[];
  contentWarnings: Array<{ key: string; label: string; severity: 'warning' | 'error' }>;
  audience: { total: number; suppressed: number; allowed: number };
  duplicateName: boolean;
};

const statusConfig: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground', icon: Clock },
  scheduled: { label: 'Scheduled', className: 'bg-sky-50 text-sky-700', icon: Clock },
  sending: { label: 'Sending', className: 'bg-amber-50 text-amber-700', icon: Send },
  sent: { label: 'Sent', className: 'bg-emerald-50 text-emerald-700', icon: CheckCircle },
  paused: { label: 'Paused', className: 'bg-purple-50 text-purple-700', icon: Clock },
  partial_failed: { label: 'Partial Failed', className: 'bg-orange-50 text-orange-700', icon: ShieldCheck },
  cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-700', icon: Mail },
};

export function Campaigns() {
  const { campaigns, contacts, companies, templates, addCampaign, deleteCampaign, sendCampaignNow, refreshData, apiError } = useData();
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [builderMode, setBuilderMode] = useState<'blocks' | 'html'>('blocks');
  const [form, setForm] = useState({
    name: '',
    subject: '',
    previewText: '',
    fromName: '',
    fromEmail: '',
    replyToEmail: '',
    body: '',
    contentBlocks: defaultEmailBlocks() as EmailContentBlock[],
    abTestEnabled: false,
    selectedVariant: 'a',
    variantBSubject: '',
    variantBPreviewText: '',
    variantBBody: '',
    status: 'draft' as 'draft' | 'scheduled',
    scheduledAt: '',
    trackOpens: true,
    trackClicks: true,
    gdprConsent: false,
    doubleOptIn: false,
    companyAddress: '',
    campaignTags: '',
    audienceType: 'customers',
    tag: 'all',
    companyId: 'all',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preflight, setPreflight] = useState<CampaignPreflight | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [compareResults, setCompareResults] = useState<Array<{ id: string; name: string; openRate: number; clickRate: number; bounceRate: number; totalRecipients: number }> | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'openRate'>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const campaignsPerPage = 10;

  const filteredCampaigns = useMemo(() => {
    let result = campaigns.filter(c => filter === 'all' || (filter === 'starred' ? (c as any).starred : c.status === filter));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q) || c.subject.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'openRate') return (b.totalRecipients > 0 ? b.openCount / b.totalRecipients : 0) - (a.totalRecipients > 0 ? a.openCount / a.totalRecipients : 0);
      return 0;
    });
    return result;
  }, [campaigns, filter, searchQuery, sortBy]);

  const totalPages = Math.ceil(filteredCampaigns.length / campaignsPerPage);
  const paginatedCampaigns = filteredCampaigns.slice((currentPage - 1) * campaignsPerPage, currentPage * campaignsPerPage);
  useEffect(() => { setCurrentPage(1); }, [filter, searchQuery, sortBy]);
  const marketableContacts = contacts.filter(c => c.marketingConsent);
  const marketableCustomers = marketableContacts.filter(c => c.status === 'customer');
  const availableTags = useMemo(() => Array.from(new Set(contacts.flatMap(c => c.tags))).sort(), [contacts]);
  const recipientFilter = useMemo(() => {
    if (form.audienceType === 'customers') return { mode: 'all', statuses: ['customer'] };
    if (form.audienceType === 'leads') return { mode: 'all', statuses: ['lead', 'prospect'] };
    if (form.audienceType === 'tag' && form.tag !== 'all') return { mode: 'all', tags: [form.tag] };
    if (form.audienceType === 'company' && form.companyId !== 'all') return { mode: 'all', companyId: form.companyId };
    return { mode: 'all' };
  }, [form.audienceType, form.tag, form.companyId]);
  const estimatedRecipients = useMemo(() => contacts.filter(contact => {
    if (!contact.marketingConsent) return false;
    if (recipientFilter.statuses?.length && !recipientFilter.statuses.includes(contact.status)) return false;
    if (recipientFilter.tags?.length && !recipientFilter.tags.some(tag => contact.tags.includes(tag))) return false;
    if (recipientFilter.companyId && contact.companyId !== recipientFilter.companyId) return false;
    return true;
  }).length, [contacts, recipientFilter]);
  const bodyHtml = builderMode === 'blocks' ? blocksToHtml(form.contentBlocks) : form.body;
  const currentAudienceCount = preflight?.audience.allowed ?? estimatedRecipients;
  const senderDomainName = form.fromEmail.split('@')[1]?.toLowerCase() ?? '';
  const senderDomain = domains.find(domain => domain.domain === senderDomainName);
  const senderDomainVerified = !!senderDomain && [senderDomain.spfStatus, senderDomain.dkimStatus, senderDomain.dmarcStatus, senderDomain.mxStatus].every(status => status === 'verified');
  const reviewItems = [
    { label: 'Audience has opted-in recipients', passed: currentAudienceCount > 0, action: '/audience-setup' },
    { label: 'Sender domain is added', passed: !!senderDomain, action: '/domain-setup' },
    { label: 'Sender domain DNS is verified', passed: senderDomainVerified, action: '/domain-setup' },
    { label: 'Campaign content is ready', passed: !!bodyHtml.trim(), action: null },
    { label: 'Company address is present', passed: !!form.companyAddress.trim(), action: null },
    { label: 'Compliance consent is confirmed', passed: form.gdprConsent, action: null },
    { label: 'Unsubscribe footer will be added automatically', passed: true, action: null },
  ];

  useEffect(() => {
    apiRequest<DomainSummary[]>('/email/domains')
      .then(setDomains)
      .catch(() => setDomains([]));
  }, []);

  const buildCampaignPayload = () => {
    const abVariants: EmailAbVariant[] | undefined = form.abTestEnabled ? [
      { id: 'a', label: 'Variant A', subject: form.subject.trim(), previewText: form.previewText.trim() || undefined, body: bodyHtml, contentBlocks: form.contentBlocks },
      { id: 'b', label: 'Variant B', subject: form.variantBSubject.trim() || form.subject.trim(), previewText: form.variantBPreviewText.trim() || undefined, body: form.variantBBody.trim() || bodyHtml },
    ] : undefined;
    return {
      name: form.name.trim(),
      subject: form.subject.trim(),
      previewText: form.previewText.trim() || undefined,
      fromName: form.fromName.trim(),
      fromEmail: form.fromEmail.trim(),
      replyToEmail: form.replyToEmail.trim() || undefined,
      body: bodyHtml.trim(),
      bodyPlainText: bodyHtml.trim().replace(/<[^>]+>/g, ' '),
      contentBlocks: form.contentBlocks,
      abTestEnabled: form.abTestEnabled,
      abVariants,
      selectedVariant: form.abTestEnabled ? form.selectedVariant : undefined,
      status: form.status,
      scheduledAt: form.status === 'scheduled' ? form.scheduledAt : undefined,
      totalRecipients: 0,
      openCount: 0,
      clickCount: 0,
      bounceCount: 0,
      unsubCount: 0,
      trackOpens: form.trackOpens,
      trackClicks: form.trackClicks,
      gdprConsent: form.gdprConsent,
      doubleOptIn: form.doubleOptIn,
      companyAddress: form.companyAddress.trim() || undefined,
      tags: form.campaignTags ? form.campaignTags.split(',').map(t => t.trim()).filter(Boolean) : [],
      recipientFilter,
    };
  };

  useEffect(() => {
    if (!showModal) return;
    const timer = window.setTimeout(() => {
      const hasEnoughInput = form.name.trim() || form.subject.trim() || form.fromEmail.trim() || bodyHtml.trim();
      if (!hasEnoughInput) {
        setPreflight(null);
        return;
      }
      setPreflightLoading(true);
      apiRequest<CampaignPreflight>('/email/campaigns/preflight', {
        method: 'POST',
        body: JSON.stringify(buildCampaignPayload()),
      })
        .then(data => {
          setPreflight(data);
          setSubmitError('');
        })
        .catch(err => setSubmitError(err instanceof Error ? err.message : 'Unable to run campaign preflight'))
        .finally(() => setPreflightLoading(false));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [showModal, form.name, form.subject, form.previewText, form.fromName, form.fromEmail, form.replyToEmail, form.body, form.contentBlocks, form.abTestEnabled, form.selectedVariant, form.variantBSubject, form.variantBPreviewText, form.variantBBody, form.trackOpens, form.trackClicks, form.gdprConsent, form.doubleOptIn, form.companyAddress, form.audienceType, form.tag, form.companyId, form.status, form.scheduledAt, builderMode, bodyHtml]);

  const totalSent = campaigns.filter(c => c.status === 'sent').reduce((sum, c) => sum + c.totalRecipients, 0);
  const totalOpens = campaigns.filter(c => c.status === 'sent').reduce((sum, c) => sum + c.openCount, 0);
  const totalClicks = campaigns.filter(c => c.status === 'sent').reduce((sum, c) => sum + c.clickCount, 0);
  const openRate = totalSent > 0 ? (totalOpens / totalSent) * 100 : 0;
  const clickRate = totalSent > 0 ? (totalClicks / totalSent) * 100 : 0;

  const chartData = campaigns
    .filter(c => c.status === 'sent')
    .map(c => ({
      name: c.name.length > 16 ? c.name.slice(0, 14) + '…' : c.name,
      openRate: c.totalRecipients > 0 ? +((c.openCount / c.totalRecipients) * 100).toFixed(1) : 0,
      clickRate: c.totalRecipients > 0 ? +((c.clickCount / c.totalRecipients) * 100).toFixed(1) : 0,
    }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Campaign name is required';
    if (!form.subject.trim()) e.subject = 'Subject line is required';
    if (!form.fromName.trim()) e.fromName = 'Sender name is required';
    if (!form.fromEmail.trim()) e.fromEmail = 'Sender email is required';
    if (!bodyHtml.trim()) e.body = 'Email body is required';
    if (form.status === 'scheduled' && !form.scheduledAt) e.scheduledAt = 'Schedule date is required';
    if (form.abTestEnabled) {
      const variantBChanged = [form.variantBSubject, form.variantBPreviewText, form.variantBBody]
        .some(value => value.trim().length > 0);
      if (!variantBChanged) e.abVariants = 'Variant B must differ from Variant A';
    }
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    const payload = buildCampaignPayload();
    setSubmitting(true);
    setSubmitError('');
    try {
      const finalPreflight = await apiRequest<CampaignPreflight>('/email/campaigns/preflight', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setPreflight(finalPreflight);
      if (form.status === 'scheduled' && !finalPreflight.ready) {
        setErrors(finalPreflight.fields);
        setSubmitError(finalPreflight.blockingErrors.join(', '));
        return;
      }
      if (form.status === 'scheduled') {
        await apiRequest<Campaign>('/email/campaigns/create-and-schedule', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        await refreshData();
      } else {
        addCampaign(payload);
      }
      setShowModal(false);
      setForm({ name: '', subject: '', previewText: '', fromName: '', fromEmail: '', replyToEmail: '', body: '', contentBlocks: defaultEmailBlocks(), abTestEnabled: false, selectedVariant: 'a', variantBSubject: '', variantBPreviewText: '', variantBBody: '', status: 'draft', scheduledAt: '', trackOpens: true, trackClicks: true, gdprConsent: false, doubleOptIn: false, companyAddress: '', audienceType: 'customers', tag: 'all', companyId: 'all' });
      setErrors({});
      setPreflight(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to save campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const set = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {apiError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {apiError}
        </div>
      )}

      {/* New Campaign Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-3xl border border-border max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground">New Campaign</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Set up your email campaign details</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {submitError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {submitError}
                </div>
              )}

              {templates.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-sm">Template</Label>
                  <Select value="none" onValueChange={value => {
                    const template = templates.find(item => item.id === value);
                    if (!template) return;
                    setForm(f => ({
                      ...f,
                      subject: template.subject,
                      body: template.body,
                      contentBlocks: template.contentBlocks ?? f.contentBlocks,
                    }));
                    setBuilderMode(template.contentBlocks?.length ? 'blocks' : 'html');
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Start from a saved template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No template</SelectItem>
                      {templates.map(template => (
                        <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="camp-name" className="text-sm">Campaign Name</Label>
                <Input
                  id="camp-name"
                  placeholder="e.g. Q3 Product Launch"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="camp-subject" className="text-sm">Subject Line</Label>
                  <Input
                    id="camp-subject"
                    placeholder="e.g. Introducing Our New Features"
                    value={form.subject}
                    onChange={e => set('subject', e.target.value)}
                    className={errors.subject ? 'border-destructive' : ''}
                  />
                  {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="camp-preview" className="text-sm">Preview Text</Label>
                  <Input
                    id="camp-preview"
                    placeholder="Brief text shown in inbox preview"
                    value={form.previewText}
                    onChange={e => set('previewText', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="camp-from-name" className="text-sm">Sender Name</Label>
                  <Input
                    id="camp-from-name"
                    placeholder="Sender name"
                    value={form.fromName}
                    onChange={e => set('fromName', e.target.value)}
                    className={errors.fromName ? 'border-destructive' : ''}
                  />
                  {errors.fromName && <p className="text-xs text-destructive">{errors.fromName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="camp-from-email" className="text-sm">Sender Email</Label>
                  <Input
                    id="camp-from-email"
                    type="email"
                    placeholder="sender@yourdomain.com"
                    value={form.fromEmail}
                    onChange={e => set('fromEmail', e.target.value)}
                    className={errors.fromEmail ? 'border-destructive' : ''}
                  />
                  {errors.fromEmail && <p className="text-xs text-destructive">{errors.fromEmail}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="camp-reply" className="text-sm">Reply-To Email</Label>
                <Input
                  id="camp-reply"
                  type="email"
                  placeholder="replies@yourdomain.com (optional)"
                  value={form.replyToEmail}
                  onChange={e => set('replyToEmail', e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Email Builder</Label>
                  <Tabs value={builderMode} onValueChange={(value) => setBuilderMode(value as 'blocks' | 'html')}>
                    <TabsList className="h-8">
                      <TabsTrigger value="blocks" className="text-xs">Blocks</TabsTrigger>
                      <TabsTrigger value="html" className="text-xs">HTML</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                {builderMode === 'blocks' ? (
                  <EmailContentBuilder blocks={form.contentBlocks} onChange={blocks => setForm(f => ({ ...f, contentBlocks: blocks }))} />
                ) : (
                  <Textarea
                    placeholder="Write the email content. HTML links will be tracked when click tracking is enabled."
                    value={form.body}
                    onChange={e => set('body', e.target.value)}
                    className={errors.body ? 'border-destructive min-h-[160px]' : 'min-h-[160px]'}
                  />
                )}
                {errors.body && <p className="text-xs text-destructive">{errors.body}</p>}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-border p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Desktop Preview</p>
                    <div className="rounded border border-border bg-white p-4 text-sm" dangerouslySetInnerHTML={{ __html: bodyHtml || '<p>No content yet.</p>' }} />
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mobile Preview</p>
                    <div className="mx-auto max-w-[260px] rounded-xl border border-border bg-white p-3 text-sm" dangerouslySetInnerHTML={{ __html: bodyHtml || '<p>No content yet.</p>' }} />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <Label className="text-sm">Manual Variant Test</Label>
                    <p className="text-xs text-muted-foreground">Store two versions and choose which one sends. Automatic winner selection is not enabled yet.</p>
                  </div>
                  <Switch checked={form.abTestEnabled} onCheckedChange={v => setForm(f => ({ ...f, abTestEnabled: v }))} />
                </div>
                {form.abTestEnabled && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Selected Variant</Label>
                      <Select value={form.selectedVariant} onValueChange={v => setForm(f => ({ ...f, selectedVariant: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="a">Variant A</SelectItem>
                          <SelectItem value="b">Variant B</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Variant B Subject</Label>
                      <Input value={form.variantBSubject} onChange={e => set('variantBSubject', e.target.value)} placeholder="Alternate subject line" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Variant B Preview Text</Label>
                      <Input value={form.variantBPreviewText} onChange={e => set('variantBPreviewText', e.target.value)} placeholder="Alternate inbox preview" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Variant B Body</Label>
                      <Textarea value={form.variantBBody} onChange={e => set('variantBBody', e.target.value)} placeholder="Optional alternate HTML/body" />
                    </div>
                  </div>
                )}
                {errors.abVariants && <p className="text-xs text-destructive">{errors.abVariants}</p>}
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Audience</p>
                  <Badge variant="secondary" className="text-xs">
                    {preflightLoading ? 'Checking...' : `${currentAudienceCount} backend-verified recipients`}
                  </Badge>
                </div>
                {preflight && (
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    {preflight.audience.total} matched, {preflight.audience.suppressed} suppressed, {preflight.audience.allowed} allowed
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Recipient Group</Label>
                    <Select value={form.audienceType} onValueChange={v => setForm(f => ({ ...f, audienceType: v, tag: 'all', companyId: 'all' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customers">All Customers</SelectItem>
                        <SelectItem value="all">All Marketable Contacts</SelectItem>
                        <SelectItem value="leads">Leads & Prospects</SelectItem>
                        <SelectItem value="tag">By Tag</SelectItem>
                        <SelectItem value="company">By Company</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.audienceType === 'tag' && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">Tag</Label>
                      <Select value={form.tag} onValueChange={v => setForm(f => ({ ...f, tag: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Choose tag</SelectItem>
                          {availableTags.map(tag => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {form.audienceType === 'company' && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">Company</Label>
                      <Select value={form.companyId} onValueChange={v => setForm(f => ({ ...f, companyId: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Choose company</SelectItem>
                          {companies.map(company => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                {marketableContacts.length === 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    No opted-in contacts are available yet. Add customers in Audience Setup before sending.
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tracking & Compliance</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <Label className="text-sm">Track Opens</Label>
                    <Switch checked={form.trackOpens} onCheckedChange={v => setForm(f => ({ ...f, trackOpens: v }))} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <Label className="text-sm">Track Clicks</Label>
                    <Switch checked={form.trackClicks} onCheckedChange={v => setForm(f => ({ ...f, trackClicks: v }))} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <Label className="text-sm">GDPR Consent</Label>
                    <Switch checked={form.gdprConsent} onCheckedChange={v => setForm(f => ({ ...f, gdprConsent: v }))} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <Label className="text-sm">Double Opt-In</Label>
                    <Switch checked={form.doubleOptIn} onCheckedChange={v => setForm(f => ({ ...f, doubleOptIn: v }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="camp-address" className="text-sm">Company Address (required by law)</Label>
                  <Input
                    id="camp-address"
                    placeholder="123 Business St, City, State"
                    value={form.companyAddress}
                    onChange={e => set('companyAddress', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="camp-tags">Campaign Tags</Label>
                  <Input
                    id="camp-tags"
                    placeholder="tag1, tag2, tag3 (comma-separated)"
                    value={form.campaignTags}
                    onChange={e => set('campaignTags', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Organize campaigns with tags for easy filtering</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Review & Send Checklist</p>
                  <Badge variant="secondary" className={reviewItems.every(item => item.passed) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>
                    {reviewItems.filter(item => item.passed).length}/{reviewItems.length}
                  </Badge>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {(preflight?.checklist ?? reviewItems).map(item => (
                    <div key={item.label} className="flex items-center justify-between rounded-lg border border-border p-2 text-xs">
                      <span className="flex items-center gap-2">
                        {item.passed ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> : <AlertCircle className="h-3.5 w-3.5 text-amber-600" />}
                        {item.label}
                      </span>
                      {'action' in item && !item.passed && item.action && <Link to={item.action} className="text-primary hover:underline">Fix</Link>}
                    </div>
                  ))}
                </div>
                {preflight?.warnings.map(warning => (
                  <div key={warning} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {warning}
                  </div>
                ))}
                {preflight?.contentWarnings.map(warning => (
                  <div key={warning.key} className={`rounded-lg border px-3 py-2 text-xs ${warning.severity === 'error' ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                    {warning.label}
                  </div>
                ))}
                {form.fromEmail && !senderDomainVerified && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    The sender domain must be added and fully verified before sending or scheduling.
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label className="text-sm">Status</Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Save as Draft</SelectItem>
                    <SelectItem value="scheduled">Schedule for Later</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.status === 'scheduled' && (
                <div className="space-y-1.5">
                  <Label htmlFor="camp-scheduled" className="text-sm">Scheduled Date</Label>
                  <Input
                    id="camp-scheduled"
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={e => set('scheduledAt', e.target.value)}
                    className={errors.scheduledAt ? 'border-destructive' : ''}
                  />
                  {errors.scheduledAt && <p className="text-xs text-destructive">{errors.scheduledAt}</p>}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border mt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submitting}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  {submitting ? 'Saving...' : form.status === 'scheduled' ? 'Schedule Campaign' : 'Save as Draft'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-foreground">Email Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create and manage your email marketing campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/audience-setup">
              <Upload className="h-4 w-4 mr-1.5" />
              Audience Setup
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/domain-setup">
              <Globe className="h-4 w-4 mr-1.5" />
              Domain Setup
            </Link>
          </Button>
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Campaign
          </Button>
        </div>
      </div>

      {marketableContacts.length === 0 && (
        <Card>
          <CardContent className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50">
                <Users className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Add your audience before launching campaigns</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Import customers, connect Google Sheets, or add opted-in contacts manually so campaigns have valid recipients.
                </p>
              </div>
            </div>
            <Button size="sm" asChild>
              <Link to="/audience-setup">Set Up Audience</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {domains.filter(domain => [domain.spfStatus, domain.dkimStatus, domain.dmarcStatus, domain.mxStatus].every(status => status === 'verified')).length === 0 && (
        <Card>
          <CardContent className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50">
                <Globe className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Verify a sending domain before sending</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Add SPF, DKIM, DMARC, and MX records for the domain used in your sender email.
                </p>
              </div>
            </div>
            <Button size="sm" asChild variant="outline">
              <Link to="/domain-setup">Set Up Domain</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Emails Sent', value: totalSent.toLocaleString(), icon: Send, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Open Rate', value: `${openRate.toFixed(1)}%`, icon: Eye, color: 'text-sky-600', bg: 'bg-sky-50', sub: `${totalOpens.toLocaleString()} opens` },
          { label: 'Click Rate', value: `${clickRate.toFixed(1)}%`, icon: MousePointerClick, color: 'text-violet-600', bg: 'bg-violet-50', sub: `${totalClicks.toLocaleString()} clicks` },
          { label: 'Total Campaigns', value: campaigns.length.toString(), icon: BarChart2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
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
                  {'sub' in stat && stat.sub && <p className="text-[10px] text-muted-foreground/70">{stat.sub}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Campaign Performance</CardTitle>
                <CardDescription>Open and click rates by campaign</CardDescription>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />Open Rate</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />Click Rate</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {([
                { key: 'openRate' as const, label: 'Open Rate', color: '#4F46E5' },
                { key: 'clickRate' as const, label: 'Click Rate', color: '#7C3AED' },
              ]).map(({ key, label, color }) => {
                const max = Math.max(...chartData.map(d => d[key]), 1);
                const latest = chartData[chartData.length - 1]?.[key] ?? 0;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                        {label}
                      </p>
                      <span className="text-sm font-semibold" style={{ color }}>{latest}%</span>
                    </div>
                    <div className="flex items-end gap-1 h-20">
                      {chartData.map((d) => (
                        <div key={d.name} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full rounded-t-sm"
                            style={{ height: `${(d[key] / max) * 56}px`, background: color, opacity: 0.75 }}
                          />
                          <span className="text-[8px] text-muted-foreground truncate w-full text-center">{d.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="h-9">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          <TabsTrigger value="draft" className="text-xs">Drafts</TabsTrigger>
          <TabsTrigger value="scheduled" className="text-xs">Scheduled</TabsTrigger>
          <TabsTrigger value="sent" className="text-xs">Sent</TabsTrigger>
          <TabsTrigger value="starred" className="text-xs">Starred</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg">
          <span className="text-sm font-medium text-indigo-700">{selectedIds.size} selected</span>
          <Button variant="destructive" size="sm" onClick={async () => {
            if (!confirm(`Delete ${selectedIds.size} campaign(s)?`)) return;
            await apiRequest('/email/campaigns/bulk-delete', { method: 'POST', body: JSON.stringify({ ids: [...selectedIds] }) });
            setSelectedIds(new Set());
            refreshData();
          }}>Delete Selected</Button>
          {selectedIds.size >= 2 && (
            <Button variant="outline" size="sm" onClick={async () => {
              const result = await apiRequest<typeof compareResults>('/email/campaigns/compare', { method: 'POST', body: JSON.stringify({ ids: [...selectedIds] }) });
              setCompareResults(result);
            }}>Compare ({selectedIds.size})</Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
        </div>
      )}

      {/* Search & Sort */}
      <div className="flex gap-3 items-center">
        <Input
          placeholder="Search campaigns..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="max-w-xs h-9"
        />
        <Select value={sortBy} onValueChange={v => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="openRate">Open Rate</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filteredCampaigns.length} campaign{filteredCampaigns.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Campaigns Cards */}
      <div className="space-y-3">
        {paginatedCampaigns.map((campaign) => {
          const cfg = statusConfig[campaign.status];
          const StatusIcon = cfg.icon;
          const campaignOpenRate = campaign.totalRecipients > 0
            ? (campaign.openCount / campaign.totalRecipients) * 100 : 0;
          const campaignClickRate = campaign.totalRecipients > 0
            ? (campaign.clickCount / campaign.totalRecipients) * 100 : 0;

          return (
            <Card key={campaign.id} className="group hover:shadow-sm transition-all p-0">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      className="mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 shrink-0"
                      checked={selectedIds.has(campaign.id)}
                      onChange={e => {
                        const next = new Set(selectedIds);
                        e.target.checked ? next.add(campaign.id) : next.delete(campaign.id);
                        setSelectedIds(next);
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                    <div className="p-2.5 rounded-xl bg-indigo-50 shrink-0">
                      <Mail className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          className="text-gray-300 hover:text-yellow-400 transition-colors"
                          onClick={async (e) => { e.stopPropagation(); await apiRequest(`/email/campaigns/${campaign.id}/toggle-star`, { method: 'POST' }); refreshData(); }}
                        >
                          {(campaign as any).starred ? <span className="text-yellow-400">&#9733;</span> : <span>&#9734;</span>}
                        </button>
                        <Link to={`/campaigns/${campaign.id}`}>
                          <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{campaign.name}</h3>
                        </Link>
                        <Badge variant="secondary" className={`text-xs h-5 ${cfg.className} gap-1`}>
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{campaign.subject}</p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        From: {campaign.fromName} &lt;{campaign.fromEmail}&gt;
                      </p>
                      {(campaign as any).tags?.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {((campaign as any).tags as string[]).map(tag => (
                            <span key={tag} className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {campaign.status === 'sent' ? (
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Recipients</p>
                        <p className="text-sm font-semibold text-foreground">{campaign.totalRecipients.toLocaleString()}</p>
                      </div>
                      <div className="text-center min-w-[80px]">
                        <p className="text-xs text-muted-foreground mb-1">Open Rate</p>
                        <p className="text-sm font-semibold text-indigo-600">{campaignOpenRate.toFixed(1)}%</p>
                        <Progress value={campaignOpenRate} className="h-1 mt-1" />
                      </div>
                      <div className="text-center min-w-[80px]">
                        <p className="text-xs text-muted-foreground mb-1">Click Rate</p>
                        <p className="text-sm font-semibold text-violet-600">{campaignClickRate.toFixed(1)}%</p>
                        <Progress value={campaignClickRate} className="h-1 mt-1" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                      {campaign.scheduledAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(campaign.scheduledAt).toLocaleDateString()}
                        </span>
                      )}
                      <span>Created {new Date(campaign.createdAt).toLocaleDateString()}</span>
                    </div>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild><Link to={`/campaigns/${campaign.id}`}>View Report</Link></DropdownMenuItem>
                      {campaign.status !== 'sent' && (
                        <DropdownMenuItem onClick={() => sendCampaignNow(campaign.id)}>Send Now</DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => addCampaign({
                        name: `${campaign.name} Copy`,
                        subject: campaign.subject,
                        fromName: campaign.fromName,
                        fromEmail: campaign.fromEmail,
                        body: campaign.body,
                        bodyPlainText: campaign.bodyPlainText,
                        status: 'draft',
                        totalRecipients: 0,
                        openCount: 0,
                        clickCount: 0,
                        bounceCount: 0,
                        unsubCount: 0,
                        trackOpens: campaign.trackOpens,
                        trackClicks: campaign.trackClicks,
                        gdprConsent: campaign.gdprConsent,
                        doubleOptIn: campaign.doubleOptIn,
                        companyAddress: campaign.companyAddress,
                        recipientFilter: campaign.recipientFilter,
                      })}>Duplicate</DropdownMenuItem>
                      <Separator className="my-1" />
                      <DropdownMenuItem className="text-destructive" onClick={() => {
                        if (window.confirm(`Delete ${campaign.name}?`)) deleteCampaign(campaign.id);
                      }}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Compare Modal */}
      {compareResults && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Campaign Comparison</h3>
              <button onClick={() => setCompareResults(null)} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground border-b"><th className="pb-2 pr-4">Campaign</th><th className="pb-2 pr-4 text-right">Recipients</th><th className="pb-2 pr-4 text-right">Open Rate</th><th className="pb-2 pr-4 text-right">Click Rate</th><th className="pb-2 text-right">Bounce Rate</th></tr></thead>
                <tbody>
                  {compareResults.map(c => (
                    <tr key={c.id} className="border-b border-gray-100">
                      <td className="py-2 pr-4 font-medium">{c.name}</td>
                      <td className="py-2 pr-4 text-right">{c.totalRecipients}</td>
                      <td className="py-2 pr-4 text-right font-medium text-blue-600">{(c.openRate * 100).toFixed(1)}%</td>
                      <td className="py-2 pr-4 text-right font-medium text-purple-600">{(c.clickRate * 100).toFixed(1)}%</td>
                      <td className="py-2 text-right text-orange-600">{(c.bounceRate * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</Button>
        </div>
      )}

      {paginatedCampaigns.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No campaigns found</p>
            <Button size="sm" className="mt-4" onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Create Campaign
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
