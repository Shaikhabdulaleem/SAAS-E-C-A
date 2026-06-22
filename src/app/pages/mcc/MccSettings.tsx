import { useEffect, useState } from 'react';
import { Settings2, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

interface MccSettingsData {
  companyName: string;
  supportEmail: string;
  primaryColor: string;
  logoUrl: string;
  notificationSenderName: string;
  notificationSenderEmail: string;
  whitelabelEnabled: boolean;
  whitelabelDomain: string;
  timezone: string;
  defaultCurrency: string;
}

const DEFAULT_SETTINGS: MccSettingsData = {
  companyName: '',
  supportEmail: '',
  primaryColor: '#6366f1',
  logoUrl: '',
  notificationSenderName: '',
  notificationSenderEmail: '',
  whitelabelEnabled: false,
  whitelabelDomain: '',
  timezone: 'UTC',
  defaultCurrency: 'USD',
};

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'US/Eastern', label: 'US/Eastern' },
  { value: 'US/Pacific', label: 'US/Pacific' },
  { value: 'Europe/London', label: 'Europe/London' },
];

const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (E)' },
  { value: 'GBP', label: 'GBP (P)' },
  { value: 'AUD', label: 'AUD (A$)' },
  { value: 'CAD', label: 'CAD (C$)' },
];

export function MccSettings() {
  const [settings, setSettings] = useState<MccSettingsData>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiRequest<MccSettingsData>('/admin/settings')
      .then((res) => setSettings({ ...DEFAULT_SETTINGS, ...res }))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const update = <K extends keyof MccSettingsData>(key: K, value: MccSettingsData[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await apiRequest('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">MCC Settings</h1>
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-24 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">MCC Settings</h1>
            <p className="text-sm text-muted-foreground">
              Configure global platform settings and branding
            </p>
          </div>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      {success && (
        <Card className="border-emerald-300 bg-emerald-50">
          <CardContent className="p-4 flex items-center gap-3 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Settings saved successfully.
          </CardContent>
        </Card>
      )}

      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company Info</CardTitle>
          <CardDescription>Basic company details displayed across the platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={settings.companyName}
                onChange={(e) => update('companyName', e.target.value)}
                placeholder="Your company name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supportEmail">Support Email</Label>
              <Input
                id="supportEmail"
                type="email"
                value={settings.supportEmail}
                onChange={(e) => update('supportEmail', e.target.value)}
                placeholder="support@company.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Branding</CardTitle>
          <CardDescription>Customize colors and logo for your platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex items-center gap-3">
                <input
                  id="primaryColor"
                  type="color"
                  value={settings.primaryColor}
                  onChange={(e) => update('primaryColor', e.target.value)}
                  className="h-10 w-14 rounded border border-input cursor-pointer"
                />
                <Input
                  value={settings.primaryColor}
                  onChange={(e) => update('primaryColor', e.target.value)}
                  placeholder="#6366f1"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                value={settings.logoUrl}
                onChange={(e) => update('logoUrl', e.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
          <CardDescription>Configure outgoing notification sender details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="notifName">Sender Name</Label>
              <Input
                id="notifName"
                value={settings.notificationSenderName}
                onChange={(e) => update('notificationSenderName', e.target.value)}
                placeholder="NexusHQ Notifications"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notifEmail">Sender Email</Label>
              <Input
                id="notifEmail"
                type="email"
                value={settings.notificationSenderEmail}
                onChange={(e) => update('notificationSenderEmail', e.target.value)}
                placeholder="noreply@company.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* White-Label */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">White-Label</CardTitle>
          <CardDescription>Enable custom domain branding for your platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="whitelabel-toggle">Enable White-Label</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Serve the platform under your own domain
              </p>
            </div>
            <Switch
              id="whitelabel-toggle"
              checked={settings.whitelabelEnabled}
              onCheckedChange={(checked) => update('whitelabelEnabled', checked)}
            />
          </div>
          {settings.whitelabelEnabled && (
            <div className="space-y-2">
              <Label htmlFor="whitelabelDomain">White-Label Domain</Label>
              <Input
                id="whitelabelDomain"
                value={settings.whitelabelDomain}
                onChange={(e) => update('whitelabelDomain', e.target.value)}
                placeholder="app.yourdomain.com"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Defaults</CardTitle>
          <CardDescription>Default timezone and currency for new tenants</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={settings.timezone}
                onValueChange={(val) => update('timezone', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default Currency</Label>
              <Select
                value={settings.defaultCurrency}
                onValueChange={(val) => update('defaultCurrency', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
