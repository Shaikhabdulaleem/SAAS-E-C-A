import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  CheckCircle, ArrowRight, ArrowLeft, Link2, Globe, Inbox, Flame,
  UserSearch, Crosshair, Plus, X, Mail, Upload, Eye, EyeOff, Search,
  ShieldCheck, ShieldAlert, ShieldX, RefreshCw, Rocket, Loader2,
  Sparkles, Clock, Play, HelpCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Separator } from '../../components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Progress } from '../../components/ui/progress';
import { Switch } from '../../components/ui/switch';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '../../components/ui/hover-card';
import { apiRequest } from '../../lib/api';

// ─── Interfaces ────────────────────────────────────────────

interface ProviderCredential {
  id: string;
  providerType: 'google_workspace' | 'microsoft_365';
  isActive: boolean;
  connectedAt: string;
  adminEmail: string | null;
  msTenantId: string | null;
}

interface SendingDomain {
  id: string;
  domain: string;
  spfStatus: 'verified' | 'not_set' | 'error';
  dkimStatus: 'verified' | 'not_set' | 'error';
  dmarcStatus: 'verified' | 'not_set' | 'error';
  mxStatus: 'verified' | 'not_set' | 'error';
  lastCheckedAt: string | null;
  createdAt: string;
}

interface MailboxOption {
  id: string;
  email: string;
  fromName: string | null;
  status: string;
  warmupStatus: string;
}

interface ProvisionPlan {
  totalDomains: number;
  dailyTarget: number;
  mailboxesNeeded: number;
  mailboxesPerDomain: number;
  emailsPerMailbox: number;
  estimatedWarmupWeeks: number;
}

interface ProvisionResult {
  summary: {
    totalDomains: number;
    totalPersonas: number;
    totalMailboxes: number;
    emailFormat: string;
    mailboxesPerDomain: number;
    estimatedWarmupWeeks: number;
  };
  domains: { id: string; domain: string }[];
  personas: Array<{ email: string; firstName: string; lastName: string }>;
}

interface WarmupPersona {
  id: string;
  fullName: string;
  email: string;
  domain: string;
  warmupStatus: 'not_started' | 'warming' | 'ready' | 'paused';
  warmupDay: number;
  warmupTotal: number;
  healthScore: number;
}

type WarmupApiPersona = Partial<WarmupPersona> & {
  firstName?: string;
  lastName?: string;
  dailySendLimit?: number;
};

type WarmupApiResponse =
  | WarmupApiPersona[]
  | { groups?: Record<string, WarmupApiPersona[]> };

interface ProspectList {
  id: string;
  name: string;
  totalCount: number;
  validCount: number;
  createdAt: string;
}

interface ColdCampaign {
  id: string;
  name: string;
  status: string;
  totalProspects: number;
  sentCount: number;
  createdAt: string;
}

interface FinderResult {
  firstName: string;
  lastName: string;
  email: string | null;
  title: string;
  companyName: string;
  emailStatus: 'verified' | 'guessed' | 'unavailable';
}

interface ApolloCredential {
  id: string;
  providerType: string;
  isActive: boolean;
  maskedKey: string;
}

// ─── Helpers ───────────────────────────────────────────────

function normalizeWarmupPersona(p: WarmupApiPersona, status?: string): WarmupPersona {
  const fullName = p.fullName ?? ([p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unnamed');
  return {
    id: p.id ?? '',
    fullName,
    email: p.email ?? '',
    domain: p.domain ?? '',
    warmupStatus: (p.warmupStatus ?? status ?? 'not_started') as WarmupPersona['warmupStatus'],
    warmupDay: p.warmupDay ?? 0,
    warmupTotal: p.warmupTotal ?? 35,
    healthScore: p.healthScore ?? 0,
  };
}

function normalizeWarmupResponse(data: WarmupApiResponse): WarmupPersona[] {
  if (Array.isArray(data)) return data.map(p => normalizeWarmupPersona(p));
  if (!data?.groups) return [];
  return Object.entries(data.groups).flatMap(([status, personas]) =>
    Array.isArray(personas) ? personas.map(p => normalizeWarmupPersona(p, status)) : [],
  );
}

const emailFormatOptions = [
  { value: 'firstname_at', label: 'john@' },
  { value: 'firstname_dot_lastname', label: 'john.carter@' },
  { value: 'firstnamelastname', label: 'johncarter@' },
  { value: 'f_dot_lastname', label: 'j.carter@' },
];

const stepsMeta = [
  { label: 'Provider', icon: Link2 },
  { label: 'Domains', icon: Globe },
  { label: 'Mailboxes', icon: Inbox },
  { label: 'Warmup', icon: Flame },
  { label: 'Prospects', icon: UserSearch },
  { label: 'Campaign', icon: Crosshair },
];

const dnsStatusIcon = (status: string) => {
  if (status === 'verified') return <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />;
  if (status === 'error') return <ShieldAlert className="h-3.5 w-3.5 text-red-500" />;
  return <ShieldX className="h-3.5 w-3.5 text-muted-foreground" />;
};

const warmupBadge: Record<string, { label: string; className: string }> = {
  not_started: { label: 'Not Started', className: 'bg-muted text-muted-foreground' },
  warming: { label: 'Warming', className: 'bg-orange-50 text-orange-700' },
  ready: { label: 'Ready', className: 'bg-emerald-50 text-emerald-700' },
  paused: { label: 'Paused', className: 'bg-amber-50 text-amber-700' },
};

async function markOnboarding(key: string) {
  try {
    await apiRequest(`/onboarding/complete/${key}`, { method: 'POST', body: JSON.stringify({}) });
  } catch { /* non-critical: onboarding tracking */ }
}

const FIELD_GUIDES: Record<string, string[]> = {
  adminEmail: [
    'Sign in to admin.google.com with a Super Admin account',
    'The admin email is the Super Admin address you used to sign in',
    'This account must have domain-wide delegation enabled',
  ],
  serviceAccountJson: [
    'Go to Google Cloud Console (console.cloud.google.com)',
    'Select your project (or create one)',
    'Navigate to IAM & Admin → Service Accounts',
    'Create a Service Account with Gmail API access',
    'Go to Keys → Add Key → Create new key (JSON)',
    'Download the JSON file and upload it here',
    'Enable domain-wide delegation in the Admin Console',
  ],
  tenantId: [
    'Go to Azure Portal (portal.azure.com)',
    'Navigate to Azure Active Directory → Overview',
    'Your Tenant ID is displayed on the overview page',
    'It is a GUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  ],
  clientId: [
    'Go to Azure Portal → Azure Active Directory → App registrations',
    'Select your app (or register a new one)',
    'The Application (client) ID is on the app Overview page',
  ],
  clientSecret: [
    'Go to Azure Portal → App registrations → your app',
    'Navigate to Certificates & Secrets → Client secrets',
    'Click "New client secret", set description and expiry',
    'Copy the Value immediately — it is only shown once',
  ],
  addDomains: [
    'Enter the sending domains you own (one per line)',
    'Use subdomains dedicated to outreach (e.g. go.yourcompany.com)',
    'Avoid your primary business domain to protect its reputation',
    'You will configure DNS (SPF, DKIM, DMARC) records after adding',
  ],
  targetVolume: [
    'Enter the total number of cold emails you want to send per day',
    'Each mailbox safely handles ~50 emails/day after warmup',
    'Start conservatively — you can scale up later',
    'Example: 500/day needs ~10 mailboxes across your domains',
  ],
  emailFormat: [
    'Choose how mailbox addresses are generated from persona names',
    '"john@" — first name only, looks casual',
    '"john.carter@" — first.last, most professional',
    '"j.carter@" — initial.last, good when names are common',
  ],
  companyName: [
    'Enter your company or brand name',
    'This is used in email signatures and sender profiles',
    'Use the name your prospects will recognize',
  ],
  jobTitle: [
    'Enter the job title for the sender personas',
    'This appears in email signatures',
    'Titles like "Account Executive" or "Partnerships Lead" work well',
  ],
  apolloApiKey: [
    'Sign in to your Apollo.io account',
    'Go to Settings (gear icon, bottom left)',
    'Navigate to Integrations → API Keys',
    'Click "Create API Key" if you don\'t have one',
    'Copy the key and paste it here',
  ],
  companyDomain: [
    'Enter the website domain of the company you want to prospect',
    'Example: stripe.com, hubspot.com, salesforce.com',
    'Apollo will find employees matching this domain',
  ],
  jobTitles: [
    'Enter one or more job titles separated by commas',
    'Example: CEO, CTO, VP of Sales, Head of Marketing',
    'Apollo filters results to people matching these titles',
  ],
  csvProspects: [
    'Paste prospect data in CSV format, one person per line',
    'Format: email, firstName, lastName, company, jobTitle',
    'Example: john@acme.com, John, Doe, Acme Corp, CEO',
    'You can export this format from LinkedIn Sales Navigator or any CRM',
  ],
  campaignName: [
    'Give your campaign a descriptive internal name',
    'Include the target audience and timeframe for easy reference',
    'Example: "Q1 SaaS Founders Outreach" or "Series A CTOs - Jan"',
  ],
  campaignGoal: [
    '"Booked Meeting" — optimizes for calendar bookings',
    '"Get Reply" — optimizes for any response',
    '"Download" — optimizes for link clicks to a resource',
  ],
  prospectList: [
    'Select a prospect list you created in the previous step',
    'Each prospect in the list will receive your email sequence',
    'You can create more lists from the Prospects step (Step 5)',
  ],
  emailSequence: [
    'Write a compelling subject line — keep it under 60 characters',
    'Leave subject empty on follow-ups to send as thread replies',
    'Use merge tags like {{firstName}} and {{companyName}} for personalization',
    'Write conversationally and keep the body brief',
    'Add multiple steps with delays to create a follow-up sequence',
  ],
};

function FieldGuide({ label, steps }: { label: string; steps: string[] }) {
  return (
    <Label className="text-sm">
      {label}
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full p-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={`Help for ${label}`}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </HoverCardTrigger>
        <HoverCardContent align="start" className="w-80 text-xs space-y-1.5">
          <p className="font-medium text-sm mb-1">How to get this</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </HoverCardContent>
      </HoverCard>
    </Label>
  );
}

function SectionGuide({ steps }: { steps: string[] }) {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full p-0 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Help"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-80 text-xs space-y-1.5">
        <p className="font-medium text-sm mb-1">How to get this</p>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
          {steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </HoverCardContent>
    </HoverCard>
  );
}

// ─── Main Component ────────────────────────────────────────

export function ColdEmailSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [initialLoading, setInitialLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Step 1: Provider
  const [providers, setProviders] = useState<ProviderCredential[]>([]);
  const [providerTab, setProviderTab] = useState('google_workspace');
  const [adminEmail, setAdminEmail] = useState('');
  const [serviceAccountJson, setServiceAccountJson] = useState('');
  const [msTenantId, setMsTenantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  // Step 2: Domains
  const [domains, setDomains] = useState<SendingDomain[]>([]);
  const [newDomainText, setNewDomainText] = useState('');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // Step 3: Provision
  const [mailboxes, setMailboxes] = useState<MailboxOption[]>([]);
  const [targetVolume, setTargetVolume] = useState(2000);
  const [emailFormat, setEmailFormat] = useState('firstname_dot_lastname');
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('Sales Development Rep');
  const [provisionPlan, setProvisionPlan] = useState<ProvisionPlan | null>(null);
  const [provisionResult, setProvisionResult] = useState<ProvisionResult | null>(null);

  // Step 4: Warmup
  const [warmupPersonas, setWarmupPersonas] = useState<WarmupPersona[]>([]);

  // Step 5: Prospects
  const [prospectLists, setProspectLists] = useState<ProspectList[]>([]);
  const [newListName, setNewListName] = useState('');
  const [selectedListId, setSelectedListId] = useState('');
  const [bulkProspects, setBulkProspects] = useState('');
  const [importedCount, setImportedCount] = useState(0);
  const [prospectSource, setProspectSource] = useState<'csv' | 'apollo'>('csv');

  // Step 5: Apollo Email Finder
  const [apolloCredential, setApolloCredential] = useState<ApolloCredential | null>(null);
  const [apolloApiKey, setApolloApiKey] = useState('');
  const [apolloDomain, setApolloDomain] = useState('');
  const [apolloTitles, setApolloTitles] = useState('');
  const [apolloResults, setApolloResults] = useState<FinderResult[]>([]);
  const [apolloSelected, setApolloSelected] = useState<Set<number>>(new Set());
  const [apolloSearching, setApolloSearching] = useState(false);

  // Step 6: Campaign
  const [campaignName, setCampaignName] = useState('');
  const [campaignGoal, setCampaignGoal] = useState('get_reply');
  const [campaignListId, setCampaignListId] = useState('');
  const [campaignMailboxIds, setCampaignMailboxIds] = useState<string[]>([]);
  const [sequenceSteps, setSequenceSteps] = useState([{ subject: '', body: '', delayDays: 0 }]);
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);
  const [launched, setLaunched] = useState(false);
  const [showDnsWarning, setShowDnsWarning] = useState(false);
  const [showLaunchConfirm, setShowLaunchConfirm] = useState(false);

  // ─── Auto-detect progress on mount ───────────────────────

  useEffect(() => {
    (async () => {
      try {
        const [prov, dom, mbox, warmup, lists, campaigns, apolloCred] = await Promise.all([
          apiRequest<ProviderCredential[]>('/provisioning/providers').catch(() => [] as ProviderCredential[]),
          apiRequest<SendingDomain[]>('/cold-email/domains').catch(() => [] as SendingDomain[]),
          apiRequest<MailboxOption[]>('/cold-email/mailboxes').catch(() => [] as MailboxOption[]),
          apiRequest<WarmupApiResponse>('/provisioning/warmup').catch(() => [] as WarmupApiPersona[]),
          apiRequest<ProspectList[]>('/cold-email/prospect-lists').catch(() => [] as ProspectList[]),
          apiRequest<ColdCampaign[]>('/cold-email/campaigns').catch(() => [] as ColdCampaign[]),
          apiRequest<ApolloCredential | null>('/cold-email/email-finder/credential').catch(() => null),
        ]);

        setProviders(prov);
        setDomains(dom);
        setMailboxes(mbox);
        if (apolloCred) { setApolloCredential(apolloCred); setProspectSource('apollo'); }
        const personas = normalizeWarmupResponse(warmup);
        setWarmupPersonas(personas);
        setProspectLists(lists);

        const done = new Set<number>();
        if (prov.length > 0) done.add(1);
        if (dom.length > 0) done.add(2);
        if (mbox.length > 0) done.add(3);
        if (personas.some(p => p.warmupStatus === 'warming' || p.warmupStatus === 'ready')) done.add(4);
        if (lists.some(l => l.totalCount > 0)) done.add(5);
        if (campaigns.length > 0) done.add(6);
        setCompletedSteps(done);

        const firstIncomplete = [1, 2, 3, 4, 5, 6].find(s => !done.has(s)) ?? 6;
        setStep(firstIncomplete);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load setup data');
      } finally {
        setInitialLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthResult = params.get('oauth');
    if (oauthResult) {
      window.history.replaceState({}, '', window.location.pathname);
      if (oauthResult === 'success') {
        apiRequest<ProviderCredential[]>('/provisioning/providers')
          .then(prov => {
            setProviders(prov);
            if (prov.length > 0) { markComplete(1); setStep(2); }
          })
          .catch(() => {});
      } else {
        setError('Google sign-in failed. Please try again.');
      }
    }
  }, []);

  // ─── Step navigation helpers ─────────────────────────────

  const markComplete = (s: number) => setCompletedSteps(prev => new Set([...prev, s]));
  const goNext = () => setStep(s => Math.min(s + 1, 6));
  const goBack = () => setStep(s => Math.max(s - 1, 1));

  // ─── Step 1: Connect Provider ────────────────────────────

  const handleConnectProvider = async () => {
    setActionLoading(true);
    setError('');
    try {
      const body = providerTab === 'google_workspace'
        ? { providerType: 'google_workspace', adminEmail, serviceAccountJson }
        : { providerType: 'microsoft_365', msTenantId, clientId, clientSecret };

      await apiRequest('/provisioning/providers/connect', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const updated = await apiRequest<ProviderCredential[]>('/provisioning/providers');
      setProviders(updated);
      setAdminEmail(''); setServiceAccountJson(''); setMsTenantId(''); setClientId(''); setClientSecret('');
      markComplete(1);
      await markOnboarding('connect_email_provider');
      goNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect provider');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGoogleOAuth = async () => {
    setActionLoading(true);
    setError('');
    try {
      const { url } = await apiRequest<{ url: string }>('/provisioning/providers/google/auth-url');
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Google sign-in');
      setActionLoading(false);
    }
  };

  const handleDisconnectProvider = async (providerId: string) => {
    setActionLoading(true);
    setError('');
    try {
      await apiRequest(`/provisioning/providers/${providerId}`, { method: 'DELETE' });
      const updated = await apiRequest<ProviderCredential[]>('/provisioning/providers');
      setProviders(updated);
      if (updated.length === 0) {
        setCompletedSteps(prev => { const n = new Set(prev); n.delete(1); return n; });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect provider');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearAllMailboxes = async () => {
    setActionLoading(true);
    setError('');
    try {
      await apiRequest('/cold-email/mailboxes/clear-all', { method: 'DELETE' });
      setMailboxes([]);
      setProvisionResult(null);
      setCompletedSteps(prev => { const n = new Set(prev); n.delete(3); return n; });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear mailboxes');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setServiceAccountJson(ev.target?.result as string);
    reader.readAsText(file);
  };

  // ─── Step 2: Add Domains ─────────────────────────────────

  const handleAddDomains = async () => {
    const domainList = newDomainText.split('\n').map(d => d.trim()).filter(Boolean);
    if (domainList.length === 0) return;
    setActionLoading(true);
    setError('');
    try {
      await apiRequest('/cold-email/domains/bulk', {
        method: 'POST',
        body: JSON.stringify({ domains: domainList }),
      });
      const updated = await apiRequest<SendingDomain[]>('/cold-email/domains');
      setDomains(updated);
      setNewDomainText('');
      markComplete(2);
      await markOnboarding('add_domain');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add domains');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyDomain = async (domainId: string) => {
    setVerifyingId(domainId);
    try {
      const verified = await apiRequest<SendingDomain>(`/cold-email/domains/${domainId}/verify`, { method: 'POST' });
      setDomains(prev => prev.map(d => d.id === domainId ? verified : d));
      if (verified.spfStatus === 'verified' || verified.dkimStatus === 'verified') {
        await markOnboarding('verify_dns');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'DNS verification failed');
    } finally {
      setVerifyingId(null);
    }
  };

  // ─── Step 3: Provision Mailboxes ─────────────────────────

  const handleCalculate = async () => {
    const validDomains = domains.map(d => d.domain);
    if (validDomains.length === 0) return;
    setActionLoading(true);
    setError('');
    try {
      const plan = await apiRequest<ProvisionPlan>('/provisioning/calculate', {
        method: 'POST',
        body: JSON.stringify({ domains: validDomains, targetDailyVolume: targetVolume }),
      });
      setProvisionPlan(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate plan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleProvision = async () => {
    const validDomains = domains.map(d => d.domain);
    setActionLoading(true);
    setError('');
    try {
      const result = await apiRequest<ProvisionResult>('/provisioning/provision', {
        method: 'POST',
        body: JSON.stringify({
          domains: validDomains,
          targetDailyVolume: targetVolume,
          emailFormat,
          companyName,
          jobTitle,
        }),
      });
      setProvisionResult(result);
      const updatedMailboxes = await apiRequest<MailboxOption[]>('/cold-email/mailboxes');
      setMailboxes(updatedMailboxes);
      markComplete(3);
      await markOnboarding('provision_mailboxes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to provision mailboxes');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Step 4: Warmup ──────────────────────────────────────

  const refreshWarmup = async () => {
    setActionLoading(true);
    try {
      const data = await apiRequest<WarmupApiResponse>('/provisioning/warmup');
      setWarmupPersonas(normalizeWarmupResponse(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh warmup status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSkipWarmup = async () => {
    markComplete(4);
    await markOnboarding('warm_up_mailboxes');
    goNext();
  };

  // ─── Step 5: Import Prospects ────────────────────────────

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      const newList = await apiRequest<ProspectList>('/cold-email/prospect-lists', {
        method: 'POST',
        body: JSON.stringify({ name: newListName.trim() }),
      });
      setProspectLists(prev => [...prev, newList]);
      setSelectedListId(newList.id);
      setNewListName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create list');
    } finally {
      setActionLoading(false);
    }
  };

  const handleImportProspects = async () => {
    if (!selectedListId || !bulkProspects.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      const lines = bulkProspects.split('\n').filter(l => l.trim());
      const prospects = lines.map(line => {
        const parts = line.split(',').map(p => p.trim());
        return {
          email: parts[0] || '',
          firstName: parts[1] || '',
          lastName: parts[2] || '',
          companyName: parts[3] || '',
          jobTitle: parts[4] || '',
        };
      }).filter(p => p.email);

      await apiRequest(`/cold-email/prospect-lists/${selectedListId}/prospects`, {
        method: 'POST',
        body: JSON.stringify({ prospects }),
      });

      setImportedCount(prospects.length);
      setBulkProspects('');
      const updatedLists = await apiRequest<ProspectList[]>('/cold-email/prospect-lists');
      setProspectLists(updatedLists);
      markComplete(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import prospects');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Step 5b: Apollo Email Finder ─────────────────────────

  const handleConnectApollo = async () => {
    if (!apolloApiKey.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      const cred = await apiRequest<ApolloCredential>('/cold-email/email-finder/credential', {
        method: 'POST',
        body: JSON.stringify({ apiKey: apolloApiKey, providerType: 'apollo' }),
      });
      setApolloCredential(cred);
      setApolloApiKey('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect Apollo');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApolloSearch = async () => {
    if (!apolloDomain.trim() && !apolloTitles.trim()) return;
    setApolloSearching(true);
    setError('');
    setApolloResults([]);
    setApolloSelected(new Set());
    try {
      const data = await apiRequest<{ results: FinderResult[]; totalCount: number }>('/cold-email/email-finder/search', {
        method: 'POST',
        body: JSON.stringify({ domain: apolloDomain, titles: apolloTitles, perPage: 25 }),
      });
      setApolloResults(data.results ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Apollo search failed';
      if (msg.includes('403') || msg.includes('free plan') || msg.includes('not accessible') || msg.includes('API_INACCESSIBLE')) {
        setError('Apollo API requires a paid plan. All search endpoints are restricted to paid accounts. Use the CSV tab to paste prospects manually, or upgrade your Apollo plan at app.apollo.io');
        setProspectSource('csv');
      } else {
        setError(msg);
      }
    } finally {
      setApolloSearching(false);
    }
  };

  const handleApolloSaveToList = async () => {
    const selected = [...apolloSelected].map(i => apolloResults[i]).filter(r => r.email);
    if (selected.length === 0 || !selectedListId) return;
    setActionLoading(true);
    setError('');
    try {
      const result = await apiRequest<{ created: number }>('/cold-email/email-finder/save-to-list', {
        method: 'POST',
        body: JSON.stringify({
          listId: selectedListId,
          prospects: selected.map(r => ({ email: r.email, firstName: r.firstName, lastName: r.lastName, companyName: r.companyName, jobTitle: r.title })),
        }),
      });
      setImportedCount(result.created);
      setApolloSelected(new Set());
      const updatedLists = await apiRequest<ProspectList[]>('/cold-email/prospect-lists');
      setProspectLists(updatedLists);
      markComplete(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save prospects');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Step 6: Campaign ────────────────────────────────────

  const toggleCampaignMailbox = (id: string) => {
    setCampaignMailboxIds(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id],
    );
  };

  const updateSequenceStep = (index: number, field: string, value: string | number) => {
    setSequenceSteps(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const addSequenceStep = () => {
    setSequenceSteps(prev => [...prev, { subject: '', body: '', delayDays: 3 }]);
  };

  const removeSequenceStep = (index: number) => {
    if (sequenceSteps.length <= 1) return;
    setSequenceSteps(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateCampaign = async () => {
    if (!campaignName.trim() || !campaignListId || campaignMailboxIds.length === 0) {
      setError('Please fill in campaign name, select a prospect list, and choose at least one mailbox');
      return;
    }
    if (!sequenceSteps.some(s => s.body.trim())) {
      setError('Add at least one email step with a body');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      const campaign = await apiRequest<{ id: string }>('/cold-email/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: campaignName,
          goal: campaignGoal,
          prospectListId: campaignListId,
          mailboxIds: campaignMailboxIds,
          trackOpens: true,
          stopOnReply: true,
          stopOnUnsubscribe: true,
        }),
      });

      await apiRequest(`/cold-email/campaigns/${campaign.id}/steps`, {
        method: 'POST',
        body: JSON.stringify({
          steps: sequenceSteps.map((s, i) => ({
            subject: s.subject,
            body: s.body,
            delayDays: s.delayDays,
            useThreading: i > 0,
            stepOrder: i,
          })),
        }),
      });

      await apiRequest(`/cold-email/campaigns/${campaign.id}/mailboxes`, {
        method: 'POST',
        body: JSON.stringify({ mailboxIds: campaignMailboxIds }),
      });

      setCreatedCampaignId(campaign.id);
      markComplete(6);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLaunchCampaign = async () => {
    if (!createdCampaignId) return;
    setActionLoading(true);
    setError('');
    try {
      await apiRequest(`/cold-email/campaigns/${createdCampaignId}/activate`, { method: 'POST' });
      await markOnboarding('launch_first_campaign');
      setLaunched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to launch campaign');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────

  if (initialLoading) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-3" />
        <p className="text-sm text-muted-foreground">Detecting your setup progress...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-600" />
          Cold Email Setup
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Get your cold outreach running in 6 simple steps
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {stepsMeta.map((meta, i) => {
          const s = i + 1;
          const isComplete = completedSteps.has(s);
          const isCurrent = step === s;
          const Icon = meta.icon;
          return (
            <div key={s} className="flex items-center gap-1">
              <button
                onClick={() => (isComplete || isCurrent) && setStep(s)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isCurrent
                    ? 'bg-indigo-600 text-white'
                    : isComplete
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {isComplete ? (
                  <CheckCircle className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{meta.label}</span>
                <span className="sm:hidden">{s}</span>
              </button>
              {s < 6 && (
                <div className={`h-0.5 w-4 ${isComplete ? 'bg-emerald-400' : 'bg-muted'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-2"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* ═══════════════════ STEP 1: PROVIDER ═══════════════════ */}
      {step === 1 && (
        <Card className="p-0">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-indigo-600" />
              Connect Email Provider
            </CardTitle>
            <CardDescription>Connect your Google Workspace or Microsoft 365 to create sending mailboxes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {providers.length > 0 && (
              <>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                    <CheckCircle className="h-4 w-4" />
                    Provider Connected
                  </div>
                  {providers.map(p => (
                    <div key={p.id} className="flex items-center justify-between mt-1">
                      <span className="text-xs text-emerald-600">
                        {p.providerType === 'google_workspace' ? 'Google Workspace' : 'Microsoft 365'}
                        {p.adminEmail && ` — ${p.adminEmail}`}
                      </span>
                      <button
                        onClick={() => handleDisconnectProvider(p.id)}
                        disabled={actionLoading}
                        className="text-red-400 hover:text-red-600 transition-colors p-0.5 rounded hover:bg-red-50"
                        title="Disconnect provider"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => { markComplete(1); goNext(); }}>
                    Next Step <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </div>
                <Separator />
                <p className="text-xs text-muted-foreground">Or connect another provider:</p>
              </>
            )}

            <Tabs value={providerTab} onValueChange={setProviderTab}>
              <TabsList>
                <TabsTrigger value="google_workspace">Google Workspace</TabsTrigger>
                <TabsTrigger value="microsoft_365">Microsoft 365</TabsTrigger>
              </TabsList>

              <TabsContent value="google_workspace" className="space-y-3 mt-3">
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  Sign in with your Google Workspace admin account to grant access. No service account or JSON keys needed.
                </div>
                <Button
                  onClick={handleGoogleOAuth}
                  disabled={actionLoading}
                  className="w-full"
                >
                  {actionLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  <Mail className="h-4 w-4 mr-2" />
                  Sign in with Google
                </Button>
              </TabsContent>

              <TabsContent value="microsoft_365" className="space-y-3 mt-3">
                <div className="space-y-1.5">
                  <FieldGuide label="Tenant ID" steps={FIELD_GUIDES.tenantId} />
                  <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={msTenantId} onChange={e => setMsTenantId(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <FieldGuide label="Client ID" steps={FIELD_GUIDES.clientId} />
                  <Input placeholder="Application (client) ID" value={clientId} onChange={e => setClientId(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <FieldGuide label="Client Secret" steps={FIELD_GUIDES.clientSecret} />
                  <div className="flex gap-2">
                    <Input
                      type={showSecret ? 'text' : 'password'}
                      placeholder="Client secret value"
                      value={clientSecret}
                      onChange={e => setClientSecret(e.target.value)}
                      className="flex-1"
                    />
                    <Button variant="outline" size="icon" onClick={() => setShowSecret(v => !v)}>
                      {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Credentials are encrypted at rest and never exposed to the frontend after connection.
            </div>

            {providerTab === 'microsoft_365' && (
              <div className="flex justify-end">
                <Button
                  onClick={handleConnectProvider}
                  disabled={actionLoading || !msTenantId.trim() || !clientId.trim() || !clientSecret.trim()}
                >
                  {actionLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  Connect & Continue <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════ STEP 2: DOMAINS ═══════════════════ */}
      {step === 2 && (
        <Card className="p-0">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-indigo-600" />
              Add Sending Domains
            </CardTitle>
            <CardDescription>Add the domains you'll send cold emails from</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {domains.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Domains</p>
                {domains.map(d => {
                  const verified = [d.spfStatus, d.dkimStatus, d.dmarcStatus, d.mxStatus].filter(s => s === 'verified').length;
                  return (
                    <div key={d.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{d.domain}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {['SPF', 'DKIM', 'DMARC', 'MX'].map((rec, i) => {
                              const status = [d.spfStatus, d.dkimStatus, d.dmarcStatus, d.mxStatus][i];
                              return (
                                <span key={rec} className="flex items-center gap-0.5 text-xs">
                                  {dnsStatusIcon(status)} {rec}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerifyDomain(d.id)}
                        disabled={verifyingId === d.id}
                      >
                        {verifyingId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        <span className="ml-1.5">Verify</span>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            <Separator />

            <div className="space-y-1.5">
              <FieldGuide label="Add Domains (one per line)" steps={FIELD_GUIDES.addDomains} />
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={"sales.example.com\noutreach.example.com\ncold.example.com"}
                value={newDomainText}
                onChange={e => setNewDomainText(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={goBack}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back
              </Button>
              <div className="flex gap-2">
                {newDomainText.trim() && (
                  <Button variant="outline" onClick={handleAddDomains} disabled={actionLoading}>
                    {actionLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Domains
                  </Button>
                )}
                {domains.length > 0 && (
                  <Button size="sm" onClick={() => {
                    const anyVerified = domains.some(d =>
                      d.spfStatus === 'verified' || d.dkimStatus === 'verified' || d.dmarcStatus === 'verified'
                    );
                    if (!anyVerified) {
                      setShowDnsWarning(true);
                    } else {
                      markComplete(2); goNext();
                    }
                  }}>
                    Next Step <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                )}
              </div>
            </div>

            {showDnsWarning && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
                <p className="text-sm font-medium text-amber-800">No DNS records verified yet</p>
                <p className="text-xs text-amber-700">
                  Emails sent from domains without verified SPF/DKIM/DMARC records will likely land in spam or be rejected.
                  We strongly recommend verifying DNS before proceeding.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowDnsWarning(false)}>
                    Go Back & Verify
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => { setShowDnsWarning(false); markComplete(2); goNext(); }}>
                    Proceed Anyway (Not Recommended)
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              After adding domains, update your DNS records (SPF, DKIM, DMARC) at your DNS provider, then click Verify.
              You also need to verify your sending domain on SendGrid for emails to be delivered.
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════ STEP 3: PROVISION ═══════════════════ */}
      {step === 3 && (
        <Card className="p-0">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Inbox className="h-4 w-4 text-indigo-600" />
              Provision Mailboxes
            </CardTitle>
            <CardDescription>We'll auto-create mailboxes and sending personas for your domains</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mailboxes.length > 0 && !provisionResult && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                    <CheckCircle className="h-4 w-4" />
                    {mailboxes.length} mailbox{mailboxes.length !== 1 ? 'es' : ''} already set up
                  </div>
                  <button
                    onClick={handleClearAllMailboxes}
                    disabled={actionLoading}
                    className="text-red-400 hover:text-red-600 transition-colors text-xs px-2 py-1 rounded hover:bg-red-50"
                  >
                    {actionLoading ? 'Clearing...' : 'Clear All'}
                  </button>
                </div>
                <div className="flex justify-end mt-2">
                  <Button size="sm" onClick={() => { markComplete(3); goNext(); }}>
                    Next Step <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </div>
              </div>
            )}

            {provisionResult ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
                  <CheckCircle className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-emerald-700">Mailboxes Provisioned!</p>
                  <p className="text-xs text-emerald-600 mt-1">
                    {provisionResult.summary.totalMailboxes} mailboxes across {provisionResult.summary.totalDomains} domain{provisionResult.summary.totalDomains !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-lg font-bold text-foreground">{provisionResult.summary.totalMailboxes}</p>
                    <p className="text-xs text-muted-foreground">Mailboxes</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-lg font-bold text-foreground">{provisionResult.summary.totalPersonas}</p>
                    <p className="text-xs text-muted-foreground">Personas</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-lg font-bold text-foreground">~{provisionResult.summary.estimatedWarmupWeeks}w</p>
                    <p className="text-xs text-muted-foreground">Warmup Time</p>
                  </div>
                </div>
                {provisionResult.personas.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {provisionResult.personas.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-muted/30">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span className="text-foreground">{p.email}</span>
                        <span className="text-muted-foreground">({p.firstName} {p.lastName})</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end">
                  <Button size="sm" onClick={goNext}>
                    Next Step <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {provisionPlan ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 bg-indigo-50 rounded-lg">
                        <p className="text-lg font-bold text-indigo-700">{provisionPlan.totalDomains}</p>
                        <p className="text-xs text-indigo-600">Domains</p>
                      </div>
                      <div className="text-center p-3 bg-indigo-50 rounded-lg">
                        <p className="text-lg font-bold text-indigo-700">{provisionPlan.mailboxesNeeded}</p>
                        <p className="text-xs text-indigo-600">Mailboxes</p>
                      </div>
                      <div className="text-center p-3 bg-indigo-50 rounded-lg">
                        <p className="text-lg font-bold text-indigo-700">{provisionPlan.emailsPerMailbox}/day</p>
                        <p className="text-xs text-indigo-600">Per Mailbox</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <FieldGuide label="Email Format" steps={FIELD_GUIDES.emailFormat} />
                        <Select value={emailFormat} onValueChange={setEmailFormat}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {emailFormatOptions.map(o => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <FieldGuide label="Company Name" steps={FIELD_GUIDES.companyName} />
                        <Input placeholder="Acme Corp" value={companyName} onChange={e => setCompanyName(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <FieldGuide label="Job Title" steps={FIELD_GUIDES.jobTitle} />
                        <Input value={jobTitle} onChange={e => setJobTitle(e.target.value)} />
                      </div>
                    </div>

                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                      Mailboxes will be auto-enrolled in warmup to build sender reputation.
                    </div>

                    <div className="flex items-center justify-between">
                      <Button variant="outline" size="sm" onClick={() => setProvisionPlan(null)}>
                        <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Change Volume
                      </Button>
                      <Button onClick={handleProvision} disabled={actionLoading}>
                        {actionLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                        Confirm & Provision <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <FieldGuide label="Target Daily Email Volume" steps={FIELD_GUIDES.targetVolume} />
                      <Input
                        type="number"
                        min={1}
                        value={targetVolume}
                        onChange={e => setTargetVolume(parseInt(e.target.value) || 0)}
                        className="max-w-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        {targetVolume > 0 ? `~${Math.ceil(targetVolume / 50)} mailboxes needed across ${domains.length} domain${domains.length !== 1 ? 's' : ''}` : '—'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <Button variant="outline" size="sm" onClick={goBack}>
                        <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back
                      </Button>
                      <Button onClick={handleCalculate} disabled={actionLoading || domains.length === 0}>
                        {actionLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                        Calculate Plan <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════ STEP 4: WARMUP ═══════════════════ */}
      {step === 4 && (
        <Card className="p-0">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Warmup Status
            </CardTitle>
            <CardDescription>
              Your mailboxes need to warm up before sending campaigns. This runs in the background — you can continue setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {warmupPersonas.length > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <p className="text-lg font-bold text-orange-700">{warmupPersonas.filter(p => p.warmupStatus === 'warming').length}</p>
                    <p className="text-xs text-orange-600">Warming Up</p>
                  </div>
                  <div className="text-center p-3 bg-emerald-50 rounded-lg">
                    <p className="text-lg font-bold text-emerald-700">{warmupPersonas.filter(p => p.warmupStatus === 'ready').length}</p>
                    <p className="text-xs text-emerald-600">Ready</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-lg font-bold text-foreground">{warmupPersonas.length}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>

                <div className="max-h-52 overflow-y-auto space-y-2">
                  {warmupPersonas.map(p => {
                    const badge = warmupBadge[p.warmupStatus] || warmupBadge.not_started;
                    const progress = p.warmupTotal > 0 ? Math.round((p.warmupDay / p.warmupTotal) * 100) : 0;
                    return (
                      <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate">{p.email}</p>
                            <Badge className={`${badge.className} text-[10px] px-1.5`}>{badge.label}</Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress value={progress} className="h-1.5 flex-1" />
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">Day {p.warmupDay}/{p.warmupTotal}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <Flame className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No warmup data yet. Provision mailboxes first.</p>
              </div>
            )}

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Warmup takes 2-5 weeks. You can proceed to set up prospects and campaigns while it runs in the background.
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={goBack}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={refreshWarmup} disabled={actionLoading}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${actionLoading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
                <Button size="sm" onClick={handleSkipWarmup}>
                  Continue Setup <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════ STEP 5: PROSPECTS ═══════════════════ */}
      {step === 5 && (
        <Card className="p-0">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserSearch className="h-4 w-4 text-indigo-600" />
              Find & Import Prospects
            </CardTitle>
            <CardDescription>Search for leads with Apollo or paste a CSV list</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing lists */}
            {prospectLists.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Lists</p>
                {prospectLists.map(l => (
                  <div
                    key={l.id}
                    onClick={() => setSelectedListId(l.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      selectedListId === l.id ? 'border-indigo-300 bg-indigo-50' : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <UserSearch className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{l.name}</span>
                    </div>
                    <Badge className="bg-muted text-muted-foreground">{l.totalCount} prospects</Badge>
                  </div>
                ))}
              </div>
            )}

            {importedCount > 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <CheckCircle className="h-4 w-4" />
                  {importedCount} prospects imported successfully!
                </div>
              </div>
            )}

            <Separator />

            {/* Create list if none selected */}
            {!selectedListId ? (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Create New List</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="List name (e.g. SaaS Founders)"
                    value={newListName}
                    onChange={e => setNewListName(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleCreateList} disabled={actionLoading || !newListName.trim()}>
                    {actionLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    Create
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Add Prospects to List</p>
                  <Button variant="outline" size="sm" onClick={() => setSelectedListId('')}>
                    Change List
                  </Button>
                </div>

                {/* Source toggle */}
                <Tabs value={prospectSource} onValueChange={v => setProspectSource(v as 'csv' | 'apollo')}>
                  <TabsList>
                    <TabsTrigger value="apollo">Search Apollo</TabsTrigger>
                    <TabsTrigger value="csv">Paste CSV</TabsTrigger>
                  </TabsList>

                  {/* ── Apollo Tab ── */}
                  <TabsContent value="apollo" className="space-y-3 mt-3">
                    {!apolloCredential ? (
                      <div className="space-y-3">
                        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                          Connect your Apollo.io API key to search for prospect emails by company, title, or domain.
                        </div>
                        <div className="space-y-1.5">
                          <FieldGuide label="Apollo API Key" steps={FIELD_GUIDES.apolloApiKey} />
                          <div className="flex gap-2">
                            <Input
                              type="password"
                              placeholder="Paste your Apollo.io API key"
                              value={apolloApiKey}
                              onChange={e => setApolloApiKey(e.target.value)}
                              className="flex-1"
                            />
                            <Button onClick={handleConnectApollo} disabled={actionLoading || !apolloApiKey.trim()}>
                              {actionLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                              Connect
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Get your API key from <span className="font-medium">Apollo.io &gt; Settings &gt; Integrations &gt; API Keys</span>
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-medium">Apollo connected</span>
                          <span className="text-muted-foreground">({apolloCredential.maskedKey})</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <FieldGuide label="Company Domain" steps={FIELD_GUIDES.companyDomain} />
                            <Input
                              placeholder="e.g. stripe.com"
                              value={apolloDomain}
                              onChange={e => setApolloDomain(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <FieldGuide label="Job Titles" steps={FIELD_GUIDES.jobTitles} />
                            <Input
                              placeholder="e.g. CEO, CTO, VP Sales"
                              value={apolloTitles}
                              onChange={e => setApolloTitles(e.target.value)}
                            />
                          </div>
                        </div>

                        <Button onClick={handleApolloSearch} disabled={apolloSearching || (!apolloDomain.trim() && !apolloTitles.trim())}>
                          {apolloSearching ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Search className="h-3.5 w-3.5 mr-1.5" />}
                          Search Apollo
                        </Button>

                        {apolloResults.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">{apolloResults.length} results found</p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const withEmail = apolloResults.map((_, i) => i).filter(i => apolloResults[i].email);
                                  setApolloSelected(prev => prev.size === withEmail.length ? new Set() : new Set(withEmail));
                                }}
                              >
                                {apolloSelected.size > 0 ? 'Deselect All' : 'Select All'}
                              </Button>
                            </div>
                            <div className="max-h-52 overflow-y-auto space-y-1 rounded-lg border border-border">
                              {apolloResults.map((r, i) => (
                                <label
                                  key={i}
                                  className={`flex items-center gap-3 px-3 py-2 text-xs cursor-pointer hover:bg-muted/50 ${!r.email ? 'opacity-40' : ''}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={apolloSelected.has(i)}
                                    onChange={() => {
                                      if (!r.email) return;
                                      setApolloSelected(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });
                                    }}
                                    disabled={!r.email}
                                    className="rounded border-input"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <span className="font-medium text-foreground">{r.firstName} {r.lastName}</span>
                                    <span className="text-muted-foreground ml-1.5">— {r.title}</span>
                                  </div>
                                  <span className="text-muted-foreground truncate max-w-[180px]">{r.email ?? 'No email'}</span>
                                  <Badge className={`text-[9px] px-1 ${r.emailStatus === 'verified' ? 'bg-emerald-50 text-emerald-700' : r.emailStatus === 'guessed' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                                    {r.emailStatus}
                                  </Badge>
                                </label>
                              ))}
                            </div>
                            {apolloSelected.size > 0 && (
                              <Button onClick={handleApolloSaveToList} disabled={actionLoading}>
                                {actionLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                                <Plus className="h-3.5 w-3.5 mr-1.5" />
                                Add {apolloSelected.size} to List
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  {/* ── CSV Tab ── */}
                  <TabsContent value="csv" className="space-y-3 mt-3">
                    <div className="space-y-1.5">
                      <FieldGuide label="Paste prospects (CSV: email, firstName, lastName, company, title)" steps={FIELD_GUIDES.csvProspects} />
                      <textarea
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder={"john@acme.com, John, Doe, Acme Corp, CEO\njane@startup.io, Jane, Smith, Startup Inc, CTO\nbob@company.com, Bob, Wilson, Company Ltd, VP Sales"}
                        value={bulkProspects}
                        onChange={e => setBulkProspects(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        One prospect per line. Format: email, firstName, lastName, company, jobTitle
                      </p>
                    </div>
                    <Button onClick={handleImportProspects} disabled={actionLoading || !bulkProspects.trim()}>
                      {actionLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                      <Upload className="h-3.5 w-3.5 mr-1.5" /> Import Prospects
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={goBack}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back
              </Button>
              {prospectLists.some(l => l.totalCount > 0) && (
                <Button size="sm" onClick={() => { markComplete(5); goNext(); }}>
                  Next Step <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════ STEP 6: CAMPAIGN ═══════════════════ */}
      {step === 6 && (
        <Card className="p-0">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-indigo-600" />
              Create & Launch Campaign
            </CardTitle>
            <CardDescription>Set up your email sequence and start reaching out</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {launched ? (
              <div className="text-center py-8">
                <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <Rocket className="h-8 w-8 text-emerald-600" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Campaign Launched!</h2>
                <p className="text-sm text-muted-foreground mt-1">Your cold outreach is now running. Replies will appear in your inbox.</p>
                <div className="flex justify-center gap-3 mt-6">
                  <Button variant="outline" onClick={() => navigate(`/cold-email/campaigns/${createdCampaignId}`)}>
                    View Campaign
                  </Button>
                  <Button onClick={() => navigate('/cold-email/campaigns')}>
                    All Campaigns <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </div>
              </div>
            ) : createdCampaignId ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
                  <CheckCircle className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-emerald-700">Campaign Created!</p>
                  <p className="text-xs text-emerald-600 mt-1">Ready to launch when you are.</p>
                </div>

                {showLaunchConfirm ? (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3">
                    <p className="text-sm font-semibold text-amber-800">Are you sure you want to launch?</p>
                    <p className="text-xs text-amber-700">
                      Once launched, emails will start sending to your prospects. This action cannot be undone.
                      Make sure you've reviewed your email sequence, prospect list, and selected mailboxes.
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowLaunchConfirm(false)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => { setShowLaunchConfirm(false); handleLaunchCampaign(); }} disabled={actionLoading}>
                        {actionLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                        Yes, Launch Now
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center gap-3">
                    <Button variant="outline" onClick={() => navigate(`/cold-email/campaigns/${createdCampaignId}`)}>
                      Review First
                    </Button>
                    <Button onClick={() => setShowLaunchConfirm(true)}>
                      <Play className="h-3.5 w-3.5 mr-1.5" /> Launch Campaign
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Campaign Settings */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Campaign Settings</p>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <FieldGuide label="Campaign Name" steps={FIELD_GUIDES.campaignName} />
                      <Input placeholder="e.g. Q1 SaaS Founders Outreach" value={campaignName} onChange={e => setCampaignName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <FieldGuide label="Goal" steps={FIELD_GUIDES.campaignGoal} />
                      <Select value={campaignGoal} onValueChange={setCampaignGoal}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="booked_meeting">Booked Meeting</SelectItem>
                          <SelectItem value="get_reply">Get Reply</SelectItem>
                          <SelectItem value="download">Download</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Prospect List */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 inline-flex items-center gap-1.5">
                    Prospect List
                    <SectionGuide steps={FIELD_GUIDES.prospectList} />
                  </p>
                  <Select value={campaignListId} onValueChange={setCampaignListId}>
                    <SelectTrigger><SelectValue placeholder="Choose a prospect list" /></SelectTrigger>
                    <SelectContent>
                      {prospectLists.map(pl => (
                        <SelectItem key={pl.id} value={pl.id}>{pl.name} ({pl.totalCount} prospects)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Mailboxes */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Select Mailboxes</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {mailboxes.map(mb => (
                      <label key={mb.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={campaignMailboxIds.includes(mb.id)}
                          onChange={() => toggleCampaignMailbox(mb.id)}
                          className="rounded border-input"
                        />
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm text-foreground">{mb.email}</span>
                      </label>
                    ))}
                    {mailboxes.length === 0 && (
                      <p className="text-xs text-muted-foreground">No mailboxes available. Go back to Step 3.</p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Sequence Steps */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider inline-flex items-center gap-1.5">
                      Email Sequence
                      <SectionGuide steps={FIELD_GUIDES.emailSequence} />
                    </p>
                    <Button variant="outline" size="sm" onClick={addSequenceStep}>
                      <Plus className="h-3 w-3 mr-1" /> Add Step
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {sequenceSteps.map((seq, i) => (
                      <div key={i} className="p-3 rounded-lg border border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge className="bg-indigo-50 text-indigo-700">Step {i + 1}</Badge>
                          <div className="flex items-center gap-2">
                            {i > 0 && (
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <Input
                                  type="number"
                                  min={0}
                                  value={seq.delayDays}
                                  onChange={e => updateSequenceStep(i, 'delayDays', parseInt(e.target.value) || 0)}
                                  className="w-16 h-7 text-xs"
                                />
                                <span className="text-xs text-muted-foreground">days wait</span>
                              </div>
                            )}
                            {sequenceSteps.length > 1 && (
                              <button onClick={() => removeSequenceStep(i)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <Input
                          placeholder="Subject line (leave empty for thread reply)"
                          value={seq.subject}
                          onChange={e => updateSequenceStep(i, 'subject', e.target.value)}
                        />
                        <textarea
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder={"Hi {{firstName}},\n\nI noticed {{companyName}} is...\n\nWould you be open to a quick chat?\n\nBest,\n{{senderFirstName}}"}
                          value={seq.body}
                          onChange={e => updateSequenceStep(i, 'body', e.target.value)}
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {['{{firstName}}', '{{lastName}}', '{{companyName}}', '{{jobTitle}}', '{{senderFirstName}}', '{{senderEmail}}'].map(v => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => updateSequenceStep(i, 'body', seq.body + v)}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={goBack}>
                    <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back
                  </Button>
                  <Button onClick={handleCreateCampaign} disabled={actionLoading}>
                    {actionLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    Create Campaign <Rocket className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
