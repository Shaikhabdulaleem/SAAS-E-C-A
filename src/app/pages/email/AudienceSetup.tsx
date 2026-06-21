import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { CheckCircle, FileSpreadsheet, Plus, RefreshCw, Upload, Users } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { apiRequest } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';

type ImportPreview = {
  headers: string[];
  rows: Array<{
    rowNumber: number;
    valid: boolean;
    duplicate: boolean;
    existing: boolean;
    errors: string[];
    normalized: { email: string; firstName: string; lastName: string; status: string; marketingConsent: boolean };
  }>;
  summary: {
    totalRows: number;
    valid: number;
    invalid: number;
    duplicates: number;
    missingConsent: number;
    marketable: number;
  };
};

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  duplicates: number;
  totalRows: number;
  marketable: number;
};

const defaultMapping = {
  firstName: 'firstName',
  lastName: 'lastName',
  email: 'email',
  phone: 'phone',
  jobTitle: 'jobTitle',
  company: 'company',
  status: 'status',
  tags: 'tags',
  marketingConsent: 'marketingConsent',
  marketingConsentSource: 'marketingConsentSource',
};

export function AudienceSetup() {
  const { contacts, addContact, refreshData, apiError } = useData();
  const [csvText, setCsvText] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [worksheet, setWorksheet] = useState('Sheet1');
  const [source, setSource] = useState<'file' | 'sheets'>('file');
  const [mapping, setMapping] = useState(defaultMapping);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [manual, setManual] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    status: 'customer' as 'lead' | 'prospect' | 'customer' | 'churned',
    tags: '',
    marketingConsent: true,
  });

  const marketableContacts = useMemo(
    () => contacts.filter((contact) => contact.marketingConsent && contact.status === 'customer'),
    [contacts],
  );

  const previewBody = () => source === 'file'
    ? { csvText, mapping }
    : { sheetUrl, worksheet, mapping };

  const previewPath = () => source === 'file' ? '/contacts/import/preview' : '/contacts/google-sheets/preview';
  const importPath = () => source === 'file' ? '/contacts/import' : '/contacts/google-sheets/import';

  const handleFile = async (file?: File) => {
    if (!file) return;
    setCsvText(await file.text());
    setPreview(null);
    setResult(null);
  };

  const runPreview = async () => {
    setLoading(true);
    setMessage(null);
    setResult(null);
    try {
      const next = await apiRequest<ImportPreview>(previewPath(), {
        method: 'POST',
        body: JSON.stringify(previewBody()),
      });
      setPreview(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to preview import');
    } finally {
      setLoading(false);
    }
  };

  const runImport = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const next = await apiRequest<ImportResult>(importPath(), {
        method: 'POST',
        body: JSON.stringify(previewBody()),
      });
      setResult(next);
      await refreshData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to import contacts');
    } finally {
      setLoading(false);
    }
  };

  const addManualContact = (event: FormEvent) => {
    event.preventDefault();
    addContact({
      firstName: manual.firstName.trim(),
      lastName: manual.lastName.trim() || '-',
      email: manual.email.trim(),
      phone: manual.phone.trim() || undefined,
      status: manual.status,
      source: 'manual',
      tags: manual.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      marketingConsent: manual.marketingConsent,
      marketingConsentSource: manual.marketingConsent ? 'manual' : undefined,
    });
    setManual({ firstName: '', lastName: '', email: '', phone: '', company: '', status: 'customer', tags: '', marketingConsent: true });
  };

  const setMap = (field: keyof typeof defaultMapping, value: string) => {
    setMapping((current) => ({ ...current, [field]: value }));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {(apiError || message) && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {message ?? apiError}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-foreground">Audience Setup</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Add opted-in customers before launching Email Marketing campaigns</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/campaigns">Back to Campaigns</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total contacts" value={contacts.length.toLocaleString()} />
        <Stat label="Marketable customers" value={marketableContacts.length.toLocaleString()} />
        <Stat label="Opted in" value={contacts.filter((contact) => contact.marketingConsent).length.toLocaleString()} />
        <Stat label="Customers" value={contacts.filter((contact) => contact.status === 'customer').length.toLocaleString()} />
      </div>

      <Tabs defaultValue="upload" onValueChange={(value) => setSource(value === 'sheets' ? 'sheets' : 'file')}>
        <TabsList className="h-9">
          <TabsTrigger value="upload" className="text-xs">Upload File</TabsTrigger>
          <TabsTrigger value="sheets" className="text-xs">Google Sheets</TabsTrigger>
          <TabsTrigger value="manual" className="text-xs">Add Manually</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-4">
          <ImportPanel
            source="file"
            setSource={setSource}
            mapping={mapping}
            setMap={setMap}
            preview={preview}
            result={result}
            loading={loading}
            runPreview={runPreview}
            runImport={runImport}
            onFile={handleFile}
            csvText={csvText}
            setCsvText={setCsvText}
          />
        </TabsContent>

        <TabsContent value="sheets" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Google Sheets Import</CardTitle>
              <CardDescription>Share the sheet with the app service account, then paste the sheet URL.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-[1fr_180px] gap-3">
                <div className="space-y-1.5">
                  <Label>Google Sheet URL</Label>
                  <Input value={sheetUrl} onChange={(event) => setSheetUrl(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Worksheet</Label>
                  <Input value={worksheet} onChange={(event) => setWorksheet(event.target.value)} placeholder="Sheet1" />
                </div>
              </div>
              <ImportControls source="sheets" setSource={setSource} mapping={mapping} setMap={setMap} preview={preview} result={result} loading={loading} runPreview={runPreview} runImport={runImport} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Add Contact Manually</CardTitle>
              <CardDescription>Use this when the customer list is small or Jawad needs to add a single opted-in customer.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={addManualContact} className="grid md:grid-cols-2 gap-4">
                <Field label="First Name" value={manual.firstName} onChange={(value) => setManual((current) => ({ ...current, firstName: value }))} required />
                <Field label="Last Name" value={manual.lastName} onChange={(value) => setManual((current) => ({ ...current, lastName: value }))} />
                <Field label="Email" type="email" value={manual.email} onChange={(value) => setManual((current) => ({ ...current, email: value }))} required />
                <Field label="Phone" value={manual.phone} onChange={(value) => setManual((current) => ({ ...current, phone: value }))} />
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={manual.status} onValueChange={(value) => setManual((current) => ({ ...current, status: value as typeof manual.status }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="churned">Churned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Field label="Tags" value={manual.tags} onChange={(value) => setManual((current) => ({ ...current, tags: value }))} placeholder="launch, vip" />
                <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <Label>Marketing consent</Label>
                    <p className="text-xs text-muted-foreground">Required before this contact can receive marketing campaigns.</p>
                  </div>
                  <Switch checked={manual.marketingConsent} onCheckedChange={(value) => setManual((current) => ({ ...current, marketingConsent: value }))} />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit" size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" /> Add Contact</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ImportPanel(props: {
  source: 'file';
  setSource: (source: 'file' | 'sheets') => void;
  mapping: typeof defaultMapping;
  setMap: (field: keyof typeof defaultMapping, value: string) => void;
  preview: ImportPreview | null;
  result: ImportResult | null;
  loading: boolean;
  runPreview: () => void;
  runImport: () => void;
  onFile: (file?: File) => void;
  csvText: string;
  setCsvText: (value: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Upload Customer File</CardTitle>
        <CardDescription>Upload a CSV or tab-separated file exported from Excel or Google Sheets.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-[260px_1fr] gap-3">
          <div className="space-y-1.5">
            <Label>File</Label>
            <Input type="file" accept=".csv,.tsv,.txt" onChange={(event) => props.onFile(event.target.files?.[0])} />
          </div>
          <div className="space-y-1.5">
            <Label>Or paste rows</Label>
            <Textarea value={props.csvText} onChange={(event) => props.setCsvText(event.target.value)} className="min-h-[88px]" placeholder="firstName,lastName,email,status,marketingConsent" />
          </div>
        </div>
        <ImportControls {...props} />
      </CardContent>
    </Card>
  );
}

function ImportControls(props: {
  source: 'file' | 'sheets';
  setSource: (source: 'file' | 'sheets') => void;
  mapping: typeof defaultMapping;
  setMap: (field: keyof typeof defaultMapping, value: string) => void;
  preview: ImportPreview | null;
  result: ImportResult | null;
  loading: boolean;
  runPreview: () => void;
  runImport: () => void;
}) {
  return (
    <div className="space-y-4" onMouseEnter={() => props.setSource(props.source)}>
      <div className="grid md:grid-cols-5 gap-3">
        {Object.keys(defaultMapping).map((field) => (
          <div key={field} className="space-y-1.5">
            <Label className="capitalize">{field.replace(/([A-Z])/g, ' $1')}</Label>
            <Input value={props.mapping[field as keyof typeof defaultMapping]} onChange={(event) => props.setMap(field as keyof typeof defaultMapping, event.target.value)} />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={props.runPreview} disabled={props.loading}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Preview
        </Button>
        <Button type="button" size="sm" onClick={props.runImport} disabled={props.loading || !props.preview?.summary.valid}>
          <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Import Valid Rows
        </Button>
      </div>
      {props.preview && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-5 gap-2 p-3 bg-muted/40 text-xs">
            <span>Total: {props.preview.summary.totalRows}</span>
            <span>Valid: {props.preview.summary.valid}</span>
            <span>Invalid: {props.preview.summary.invalid}</span>
            <span>Duplicates: {props.preview.summary.duplicates}</span>
            <span>Marketable: {props.preview.summary.marketable}</span>
          </div>
          <div className="divide-y divide-border max-h-72 overflow-auto">
            {props.preview.rows.slice(0, 50).map((row) => (
              <div key={row.rowNumber} className="grid md:grid-cols-[80px_1fr_120px_1fr] gap-2 p-3 text-xs">
                <span>Row {row.rowNumber}</span>
                <span>{row.normalized.firstName} {row.normalized.lastName} &lt;{row.normalized.email || 'missing email'}&gt;</span>
                <Badge variant={row.valid ? 'default' : 'destructive'} className="w-fit">{row.valid ? 'Valid' : 'Invalid'}</Badge>
                <span className="text-muted-foreground">{row.errors.join(', ') || (row.existing ? 'Existing contact will update' : 'Ready')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {props.result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Imported {props.result.created + props.result.updated} contacts: {props.result.created} created, {props.result.updated} updated, {props.result.skipped} skipped.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-0">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-indigo-50"><Users className="h-4 w-4 text-indigo-600" /></div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, required }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} />
    </div>
  );
}
