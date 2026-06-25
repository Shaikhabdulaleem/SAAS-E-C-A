import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Plus, X, CheckCircle, ArrowRight, ArrowLeft, Calculator, Mail, Globe, Users, Clock, Zap, Link2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Separator } from '../../components/ui/separator';
import { Switch } from '../../components/ui/switch';
import { apiRequest } from '../../lib/api';

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

interface ProviderCredential {
  id: string;
  providerType: 'google_workspace' | 'microsoft_365';
  isActive: boolean;
  adminEmail: string | null;
  msTenantId: string | null;
}

const emailFormatOptions = [
  { value: 'firstname_at', label: 'john@' },
  { value: 'firstname_dot_lastname', label: 'john.carter@' },
  { value: 'firstnamelastname', label: 'johncarter@' },
  { value: 'f_dot_lastname', label: 'j.carter@' },
];

export function ProvisioningWizard() {
  const [step, setStep] = useState(1);
  const [domains, setDomains] = useState<string[]>(['']);
  const [targetDailyVolume, setTargetDailyVolume] = useState(2000);
  const [plan, setPlan] = useState<ProvisionPlan | null>(null);
  const [emailFormat, setEmailFormat] = useState('firstname_dot_lastname');
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('Sales Development Rep');
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [providers, setProviders] = useState<ProviderCredential[]>([]);
  const [useProvider, setUseProvider] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState('');

  useEffect(() => {
    apiRequest<ProviderCredential[]>('/provisioning/providers')
      .then(data => {
        setProviders(data);
        if (data.length > 0) {
          setSelectedProviderId(data[0].id);
          setUseProvider(true);
        }
      })
      .catch((err: unknown) => { setError(err instanceof Error ? err.message : 'Operation failed'); });
  }, []);

  const addDomain = () => {
    if (domains.length < 20) {
      setDomains(prev => [...prev, '']);
    }
  };

  const removeDomain = (index: number) => {
    setDomains(prev => prev.filter((_, i) => i !== index));
  };

  const updateDomain = (index: number, value: string) => {
    setDomains(prev => prev.map((d, i) => i === index ? value : d));
  };

  const handleCalculate = async () => {
    const validDomains = domains.filter(d => d.trim());
    if (validDomains.length === 0) return;
    setLoading(true);
    try {
      const data = await apiRequest<ProvisionPlan>('/provisioning/calculate', {
        method: 'POST',
        body: JSON.stringify({ domains: validDomains, targetDailyVolume }),
      });
      setPlan(data);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleProvision = async () => {
    const validDomains = domains.filter(d => d.trim());
    setLoading(true);
    try {
      const data = await apiRequest<ProvisionResult>('/provisioning/provision', {
        method: 'POST',
        body: JSON.stringify({
          domains: validDomains,
          targetDailyVolume,
          emailFormat,
          companyName,
          jobTitle,
        }),
      });
      setResult(data);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const validDomainCount = domains.filter(d => d.trim()).length;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-foreground">Auto-Provision Mailboxes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Add your domains and we'll auto-generate sending identities</p>
      </div>

      <div className="flex items-center gap-2 mb-2">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${step >= s ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground'}`}>
              {step > s ? <CheckCircle className="h-4 w-4" /> : s}
            </div>
            {s < 3 && (
              <div className={`h-0.5 w-12 ${step > s ? 'bg-indigo-600' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card className="p-0">
          <CardHeader>
            <CardTitle className="text-base">Enter Domains</CardTitle>
            <CardDescription>Add the domains you want to provision mailboxes for</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {domains.map((domain, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="e.g. company.com"
                    value={domain}
                    onChange={e => updateDomain(index, e.target.value)}
                    className="flex-1"
                  />
                  {domains.length > 1 && (
                    <button
                      onClick={() => removeDomain(index)}
                      className="p-2 rounded-md hover:bg-muted text-muted-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {domains.length < 20 && (
              <Button variant="outline" size="sm" onClick={addDomain}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Domain
              </Button>
            )}

            <p className="text-xs text-muted-foreground">{domains.length}/20 domains</p>

            <Separator />

            <div className="space-y-1.5">
              <Label className="text-sm">Target Daily Email Volume</Label>
              <Input
                type="number"
                min={1}
                value={targetDailyVolume}
                onChange={e => setTargetDailyVolume(parseInt(e.target.value) || 0)}
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">
                Total emails per day across all mailboxes ({targetDailyVolume > 0 ? `${Math.ceil(targetDailyVolume / 50)} mailboxes @ 50/day each` : '—'})
              </p>
            </div>

            {providers.length > 0 && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Create real mailboxes via provider API</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Auto-create mailboxes on your {providers.map(p => p.providerType === 'google_workspace' ? 'Google Workspace' : 'Microsoft 365').join(' / ')}
                    </p>
                  </div>
                  <Switch checked={useProvider} onCheckedChange={setUseProvider} />
                </div>

                {useProvider && providers.length > 1 && (
                  <div className="space-y-1.5">
                    <Label className="text-sm">Select Provider</Label>
                    <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                      <SelectTrigger className="max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {providers.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.providerType === 'google_workspace' ? 'Google Workspace' : 'Microsoft 365'}
                            {p.adminEmail ? ` (${p.adminEmail})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            {providers.length === 0 && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 px-4 py-3">
                <div className="flex items-start gap-3">
                  <Link2 className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-indigo-900">Want real mailbox creation?</p>
                    <p className="text-xs text-indigo-700 mt-0.5">
                      <Link to="/cold-email/provider-connect" className="underline font-medium">Connect Google Workspace or Microsoft 365</Link> to auto-create mailboxes on your workspace via API.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                onClick={handleCalculate}
                disabled={loading || validDomainCount === 0}
              >
                {loading ? 'Calculating...' : (
                  <>
                    <Calculator className="h-3.5 w-3.5 mr-1.5" />
                    Calculate Plan
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && plan && (
        <div className="space-y-5">
          <Card className="p-0 border-indigo-200 bg-indigo-50/30">
            <CardHeader>
              <CardTitle className="text-base">Provisioning Plan</CardTitle>
              <CardDescription>Review the calculated plan before proceeding</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'Total Domains', value: plan.totalDomains, icon: Globe, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                  { label: 'Daily Target', value: plan.dailyTarget.toLocaleString(), icon: Mail, color: 'text-sky-600', bg: 'bg-sky-50' },
                  { label: 'Mailboxes Needed', value: plan.mailboxesNeeded, icon: Mail, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Mailboxes Per Domain', value: plan.mailboxesPerDomain, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                  { label: 'Emails Per Mailbox/Day', value: plan.emailsPerMailbox, icon: Mail, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Est. Warmup Time', value: `${plan.estimatedWarmupWeeks} weeks`, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
                ].map(stat => (
                  <div key={stat.label} className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${stat.bg}`}>
                      <stat.icon className={`h-4 w-4 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-lg font-semibold text-foreground">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="p-0">
            <CardHeader>
              <CardTitle className="text-base">Configuration</CardTitle>
              <CardDescription>Set up email format and persona details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Email Format</Label>
                <Select value={emailFormat} onValueChange={setEmailFormat}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {emailFormatOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Company Name</Label>
                <Input
                  placeholder="Your company"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  className="max-w-sm"
                />
                <p className="text-xs text-muted-foreground">Used for persona profiles</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Default Job Title</Label>
                <Input
                  placeholder="Sales Development Rep"
                  value={jobTitle}
                  onChange={e => setJobTitle(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              {useProvider && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-800 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-emerald-600" />
                  Real mailboxes will be created via {providers.find(p => p.id === selectedProviderId)?.providerType === 'google_workspace' ? 'Google Workspace' : 'Microsoft 365'} API
                </div>
              )}

              <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-2.5 text-xs text-indigo-800">
                All mailboxes auto-enroll in warmup: Week1=5/day, Week2=10, Week3=20, Week4=35, Week5+=50.
                Campaign sending blocked until health score &gt; 80. Auto-pause if bounce &gt;5% or spam &gt;0.1%.
              </div>

              <Separator />

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={handleProvision}
                  disabled={loading}
                >
                  {loading ? 'Provisioning...' : (
                    <>
                      <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                      Confirm & Create Mailboxes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 3 && result && (
        <div className="space-y-5">
          <Card className="p-0 border-emerald-200 bg-emerald-50/30">
            <CardContent className="py-8 text-center">
              <div className="p-3 rounded-full bg-emerald-100 w-fit mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Provisioning Complete</h2>
              <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground mb-4">
                <span><strong className="text-foreground">{result.summary.totalDomains}</strong> domains configured</span>
                <span><strong className="text-foreground">{result.summary.totalMailboxes}</strong> mailboxes created</span>
                <span><strong className="text-foreground">{result.summary.totalPersonas}</strong> personas generated</span>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 inline-flex items-center gap-2 text-sm text-amber-800">
                <Clock className="h-4 w-4 text-amber-600" />
                All mailboxes enrolled in warmup — sending unlocked in ~{result.summary.estimatedWarmupWeeks} weeks
              </div>
            </CardContent>
          </Card>

          <Card className="p-0">
            <CardHeader>
              <CardTitle className="text-base">Generated Accounts</CardTitle>
              <CardDescription>Email accounts created for each domain</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Domain</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Email Accounts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.domains.map(da => {
                      const domainPersonas = result.personas.filter(p => p.email.endsWith(`@${da.domain}`));
                      return (
                        <tr key={da.domain} className="border-b border-border last:border-0">
                          <td className="py-3 px-3">
                            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 text-xs">
                              {da.domain}
                            </Badge>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1.5">
                              {domainPersonas.map(p => (
                                <Badge key={p.email} variant="secondary" className="bg-muted text-foreground text-xs font-normal">
                                  {p.email}
                                </Badge>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-center gap-3">
            <Link to="/cold-email/personas">
              <Button size="sm" variant="outline">
                <Users className="h-3.5 w-3.5 mr-1.5" />
                Go to Personas
              </Button>
            </Link>
            <Link to="/cold-email/warmup">
              <Button size="sm">
                <Clock className="h-3.5 w-3.5 mr-1.5" />
                View Warmup Progress
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
