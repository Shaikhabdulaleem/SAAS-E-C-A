import { useEffect, useState, type FormEvent } from 'react';
import { Palette } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { FileUploadField } from '../../components/ui/file-upload-field';

interface BrandData {
  companyName: string | null;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  address: string | null;
  aboutUsText: string | null;
  proposalPrefix: string | null;
}

const defaultBrand: BrandData = {
  companyName: '',
  logoUrl: '',
  primaryColor: '#1a56db',
  accentColor: '#7c3aed',
  fontFamily: 'Inter',
  contactEmail: '',
  contactPhone: '',
  websiteUrl: '',
  address: '',
  aboutUsText: '',
  proposalPrefix: '',
};

export function BrandSettings({ hideHeader = false }: { hideHeader?: boolean }) {
  const [form, setForm] = useState<BrandData>(defaultBrand);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<BrandData>('/client/brand-settings')
      .then((data) => setForm({ ...defaultBrand, ...data }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (field: keyof BrandData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest('/client/brand-settings', { method: 'PUT', body: JSON.stringify(form) });
      setMessage('Brand settings saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {!hideHeader && (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10"><Palette className="h-4 w-4 text-primary" /></div>
          <div>
            <h1 className="text-xl font-semibold">Brand Settings</h1>
            <p className="text-sm text-muted-foreground">Configure your branding for proposals and client-facing documents.</p>
          </div>
        </div>
      )}

      {(error || message) && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {error || message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <Card>
              <CardHeader><CardTitle className="text-base">Company Information</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-1.5">
                    <Label>Company Name</Label>
                    <Input value={form.companyName ?? ''} onChange={(e) => set('companyName', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Contact Email</Label>
                    <Input type="email" value={form.contactEmail ?? ''} onChange={(e) => set('contactEmail', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Contact Phone</Label>
                    <Input value={form.contactPhone ?? ''} onChange={(e) => set('contactPhone', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Website URL</Label>
                    <Input value={form.websiteUrl ?? ''} onChange={(e) => set('websiteUrl', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Proposal Prefix (2-5 chars)</Label>
                    <Input maxLength={5} value={form.proposalPrefix ?? ''} onChange={(e) => set('proposalPrefix', e.target.value.toUpperCase())} placeholder="e.g., TGA" />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label>Address</Label>
                    <Input value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label>About Us</Label>
                    <Textarea rows={4} value={form.aboutUsText ?? ''} onChange={(e) => set('aboutUsText', e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Branding</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>Logo</Label>
                    <FileUploadField
                      currentUrl={form.logoUrl}
                      accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                      label="Upload logo"
                      onChange={async (file) => {
                        if (file) {
                          const fd = new FormData();
                          fd.append('logo', file);
                          try {
                            const result = await apiRequest<BrandData>('/client/brand-settings/logo', { method: 'POST', body: fd });
                            setForm(prev => ({ ...prev, logoUrl: result.logoUrl }));
                          } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed'); }
                        } else {
                          try {
                            const result = await apiRequest<BrandData>('/client/brand-settings/logo', { method: 'DELETE' });
                            setForm(prev => ({ ...prev, logoUrl: result.logoUrl }));
                          } catch (err) { setError(err instanceof Error ? err.message : 'Remove failed'); }
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Primary Color</Label>
                    <div className="flex gap-2">
                      <input type="color" value={form.primaryColor} onChange={(e) => set('primaryColor', e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
                      <Input value={form.primaryColor} onChange={(e) => set('primaryColor', e.target.value)} className="flex-1" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Accent Color</Label>
                    <div className="flex gap-2">
                      <input type="color" value={form.accentColor} onChange={(e) => set('accentColor', e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
                      <Input value={form.accentColor} onChange={(e) => set('accentColor', e.target.value)} className="flex-1" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Font Family</Label>
                    <Input value={form.fontFamily} onChange={(e) => set('fontFamily', e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview */}
          <div>
            <Card className="sticky top-4">
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Preview</CardTitle></CardHeader>
              <CardContent>
                <div className="rounded-lg border p-4 space-y-3" style={{ fontFamily: form.fontFamily }}>
                  {form.logoUrl ? (
                    <img src={form.logoUrl.startsWith('/uploads/') ? `${(import.meta.env.VITE_API_URL ?? 'http://localhost:3002/api').replace(/\/api$/, '')}${form.logoUrl}` : form.logoUrl} alt="Logo" className="max-h-10" />
                  ) : (
                    <div className="text-lg font-bold" style={{ color: form.primaryColor }}>{form.companyName || 'Company Name'}</div>
                  )}
                  <div className="h-1 rounded" style={{ background: form.primaryColor }}></div>
                  <p className="text-xs text-muted-foreground">{form.contactEmail || 'email@company.com'}</p>
                  <p className="text-xs text-muted-foreground">{form.contactPhone || '+1 (555) 000-0000'}</p>
                  <div className="flex gap-2 mt-3">
                    <div className="h-8 w-8 rounded" style={{ background: form.primaryColor }}></div>
                    <div className="h-8 w-8 rounded" style={{ background: form.accentColor }}></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-5">
          <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Brand Settings'}</Button>
        </div>
      </form>
    </div>
  );
}
