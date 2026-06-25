import { useState, useEffect } from 'react';
import { Link2, Unlink, ShieldCheck, ShieldAlert, Upload, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { apiRequest } from '../../lib/api';

interface ProviderCredential {
  id: string;
  providerType: 'google_workspace' | 'microsoft_365';
  isActive: boolean;
  connectedAt: string;
  lastSyncAt: string | null;
  adminEmail: string | null;
  serviceAccountJson: string | null;
  msTenantId: string | null;
  clientId: string | null;
  clientSecret: string | null;
}

export function ProviderConnect() {
  const [providers, setProviders] = useState<ProviderCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [tab, setTab] = useState('google_workspace');

  const [adminEmail, setAdminEmail] = useState('');
  const [serviceAccountJson, setServiceAccountJson] = useState('');
  const [msTenantId, setMsTenantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchProviders(); }, []);

  const fetchProviders = async () => {
    try {
      const data = await apiRequest<ProviderCredential[]>('/provisioning/providers');
      setProviders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const body = tab === 'google_workspace'
        ? { providerType: 'google_workspace', adminEmail, serviceAccountJson }
        : { providerType: 'microsoft_365', msTenantId, clientId, clientSecret };

      await apiRequest('/provisioning/providers/connect', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setAdminEmail('');
      setServiceAccountJson('');
      setMsTenantId('');
      setClientId('');
      setClientSecret('');
      await fetchProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await apiRequest(`/provisioning/providers/${id}`, { method: 'DELETE' });
      setProviders(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setServiceAccountJson(content);
    };
    reader.readAsText(file);
  };

  const googleConnected = providers.find(p => p.providerType === 'google_workspace');
  const msConnected = providers.find(p => p.providerType === 'microsoft_365');

  const canSubmitGoogle = adminEmail.trim() && serviceAccountJson.trim();
  const canSubmitMs = msTenantId.trim() && clientId.trim() && clientSecret.trim();

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-foreground">Connect Email Provider</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Connect your Google Workspace or Microsoft 365 to auto-create mailboxes on your domains
        </p>
      </div>

      {providers.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Connected Providers</h2>
          {providers.map(provider => (
            <Card key={provider.id} className="p-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${provider.providerType === 'google_workspace' ? 'bg-red-50' : 'bg-blue-50'}`}>
                      <ShieldCheck className={`h-4 w-4 ${provider.providerType === 'google_workspace' ? 'text-red-600' : 'text-blue-600'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {provider.providerType === 'google_workspace' ? 'Google Workspace' : 'Microsoft 365'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-emerald-50 text-emerald-700">
                          Connected
                        </Badge>
                        {provider.adminEmail && (
                          <span className="text-xs text-muted-foreground">Admin: {provider.adminEmail}</span>
                        )}
                        {provider.msTenantId && (
                          <span className="text-xs text-muted-foreground">Tenant: {provider.msTenantId}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleDisconnect(provider.id)}>
                    <Unlink className="h-3.5 w-3.5 mr-1.5" />
                    Disconnect
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Separator />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="google_workspace" disabled={!!googleConnected}>
            Google Workspace
          </TabsTrigger>
          <TabsTrigger value="microsoft_365" disabled={!!msConnected}>
            Microsoft 365
          </TabsTrigger>
        </TabsList>

        <TabsContent value="google_workspace" className="mt-4">
          {googleConnected ? (
            <Card className="p-0 border-emerald-200 bg-emerald-50/30">
              <CardContent className="p-6 text-center">
                <ShieldCheck className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-emerald-800">Google Workspace is already connected</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-0">
              <CardHeader>
                <CardTitle className="text-base">Connect Google Workspace</CardTitle>
                <CardDescription>
                  Provide your admin email and a Service Account JSON key with domain-wide delegation enabled
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Admin Email</Label>
                  <Input
                    placeholder="admin@yourdomain.com"
                    value={adminEmail}
                    onChange={e => setAdminEmail(e.target.value)}
                    className="max-w-sm"
                  />
                  <p className="text-xs text-muted-foreground">The Google Workspace admin account used for domain-wide delegation</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Service Account JSON</Label>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 px-3 py-2 text-sm bg-muted rounded-md cursor-pointer hover:bg-muted/80 transition-colors">
                      <Upload className="h-3.5 w-3.5" />
                      Upload JSON file
                      <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
                    </label>
                    {serviceAccountJson && (
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 text-xs">File loaded</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Download the JSON key from Google Cloud Console &gt; IAM &gt; Service Accounts</p>
                </div>

                <div className="flex justify-end pt-2">
                  <Button size="sm" onClick={handleConnect} disabled={connecting || !canSubmitGoogle}>
                    <Link2 className="h-3.5 w-3.5 mr-1.5" />
                    {connecting ? 'Connecting...' : 'Connect Google Workspace'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="microsoft_365" className="mt-4">
          {msConnected ? (
            <Card className="p-0 border-emerald-200 bg-emerald-50/30">
              <CardContent className="p-6 text-center">
                <ShieldCheck className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-emerald-800">Microsoft 365 is already connected</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-0">
              <CardHeader>
                <CardTitle className="text-base">Connect Microsoft 365</CardTitle>
                <CardDescription>
                  Provide your Azure AD app registration credentials with User.ReadWrite.All permission
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Tenant ID</Label>
                  <Input
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={msTenantId}
                    onChange={e => setMsTenantId(e.target.value)}
                    className="max-w-sm"
                  />
                  <p className="text-xs text-muted-foreground">Found in Azure Portal &gt; Azure Active Directory &gt; Overview</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Client ID (Application ID)</Label>
                  <Input
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={clientId}
                    onChange={e => setClientId(e.target.value)}
                    className="max-w-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Client Secret</Label>
                  <div className="flex items-center gap-2 max-w-sm">
                    <Input
                      type={showSecret ? 'text' : 'password'}
                      placeholder="Client secret value"
                      value={clientSecret}
                      onChange={e => setClientSecret(e.target.value)}
                      className="flex-1"
                    />
                    <button
                      onClick={() => setShowSecret(!showSecret)}
                      className="p-2 rounded-md hover:bg-muted text-muted-foreground"
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Generate in Azure Portal &gt; App Registrations &gt; Certificates & Secrets</p>
                </div>

                <div className="flex justify-end pt-2">
                  <Button size="sm" onClick={handleConnect} disabled={connecting || !canSubmitMs}>
                    <Link2 className="h-3.5 w-3.5 mr-1.5" />
                    {connecting ? 'Connecting...' : 'Connect Microsoft 365'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Card className="p-0 border-amber-200 bg-amber-50/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900">Security Note</p>
              <p className="text-xs text-amber-700 mt-0.5">
                All credentials are encrypted at rest using AES-256-GCM. They are only decrypted when creating mailboxes on your workspace.
                We never store plaintext credentials.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
