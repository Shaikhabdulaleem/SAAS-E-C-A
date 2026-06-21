import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Copy, DollarSign, Download, Mail, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { apiRequest, downloadPdfBlob } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { useTenants } from '../contexts/TenantContext';

interface FinanceSummary {
  totalInvoiced: number;
  totalPaid: number;
  unpaid: number;
  overdue: number;
  delayed: number;
  totalCosts: number;
  netProfit: number;
}

interface FinanceInvoice {
  id: string;
  number: string;
  recipientName?: string;
  recipientEmail?: string;
  customerName?: string;
  customerEmail?: string;
  status: string;
  total: number;
  amountPaid: number;
  balanceDue?: number;
  publicToken?: string;
  pdfUrl?: string;
  dueDate?: string;
  createdAt: string;
}

interface Paginated<T> {
  items: T[];
  pagination: { page: number; pageSize: number; total: number };
}

interface FinancePayment {
  id: string;
  amount: number;
  method?: string;
  status: string;
  paidAt: string;
  invoice?: { number: string; customerName: string };
}

interface FinanceCost {
  id: string;
  vendor: string;
  category?: string;
  amount: number;
  status: string;
  incurredAt: string;
}

const invoiceFormDefault = {
  tenantId: '',
  customerName: '',
  customerEmail: '',
  itemName: '',
  quantity: '1',
  unitPrice: '',
  discountType: 'none',
  discountValue: '0',
  dueDate: '',
  notes: '',
  templateId: 'modern',
};

const paymentFormDefault = { invoiceId: '', amount: '', method: '', status: 'received', notes: '' };
const costFormDefault = { tenantId: '', vendor: '', category: '', amount: '', status: 'unpaid', notes: '' };

export function Finance({ admin = false }: { admin?: boolean }) {
  const { tenants } = useTenants();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [invoices, setInvoices] = useState<FinanceInvoice[]>([]);
  const [payments, setPayments] = useState<FinancePayment[]>([]);
  const [costs, setCosts] = useState<FinanceCost[]>([]);
  const [invoiceForm, setInvoiceForm] = useState(invoiceFormDefault);
  const [paymentForm, setPaymentForm] = useState(paymentFormDefault);
  const [costForm, setCostForm] = useState(costFormDefault);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const basePath = admin ? '/admin/finance' : '/finance';
  const unpaidInvoices = useMemo(() => invoices.filter(invoice => invoice.status !== 'paid'), [invoices]);

  const load = async () => {
    setLoading(true);
    try {
      const [nextSummary, nextInvoices, nextPayments, nextCosts] = await Promise.all([
        apiRequest<FinanceSummary>(`${basePath}/summary`),
        apiRequest<FinanceInvoice[] | Paginated<FinanceInvoice>>(`${basePath}/invoices`),
        apiRequest<FinancePayment[]>(`${basePath}/payments`),
        apiRequest<FinanceCost[]>(`${basePath}/costs`),
      ]);
      setSummary(normalizeSummary(nextSummary));
      const invoiceItems = Array.isArray(nextInvoices) ? nextInvoices : nextInvoices.items;
      setInvoices(invoiceItems.map(normalizeInvoice));
      setPayments(nextPayments.map(normalizePayment));
      setCosts(nextCosts.map(normalizeCost));
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to load finance records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [admin]);

  const createInvoice = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      await apiRequest(`${basePath}/invoices`, {
        method: 'POST',
        body: JSON.stringify({
          customerName: invoiceForm.customerName,
          customerEmail: invoiceForm.customerEmail,
          recipientName: invoiceForm.customerName,
          recipientEmail: invoiceForm.customerEmail,
          dueDate: invoiceForm.dueDate || undefined,
          discountType: invoiceForm.discountType,
          discountValue: Number(invoiceForm.discountValue) || 0,
          tenantId: invoiceForm.tenantId || undefined,
          notes: invoiceForm.notes,
          templateId: invoiceForm.templateId,
          lineItems: [{
            name: invoiceForm.itemName || 'Service',
            quantity: Number(invoiceForm.quantity) || 1,
            unitPrice: Number(invoiceForm.unitPrice) || 0,
          }],
        }),
      });
      setInvoiceForm(invoiceFormDefault);
      setMessage('Invoice created');
    });
  };

  const createPayment = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      await apiRequest(`${basePath}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: paymentForm.invoiceId || undefined,
          amount: Number(paymentForm.amount) || 0,
          method: paymentForm.method,
          status: paymentForm.status,
          notes: paymentForm.notes,
        }),
      });
      setPaymentForm(paymentFormDefault);
      setMessage('Payment recorded');
    });
  };

  const createCost = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      await apiRequest(`${basePath}/costs`, {
        method: 'POST',
        body: JSON.stringify({
          vendor: costForm.vendor,
          category: costForm.category,
          amount: Number(costForm.amount) || 0,
          tenantId: costForm.tenantId || undefined,
          status: costForm.status,
          notes: costForm.notes,
        }),
      });
      setCostForm(costFormDefault);
      setMessage('Cost recorded');
    });
  };

  const removeInvoice = async (id: string) => {
    if (!window.confirm('Delete this invoice?')) return;
    await run(() => apiRequest(`${basePath}/invoices/${id}`, { method: 'DELETE' }));
  };

  const markPaid = async (invoice: FinanceInvoice) => {
    await run(async () => {
      await apiRequest(`${basePath}/invoices/${invoice.id}/mark-paid`, {
        method: 'POST',
        body: JSON.stringify({ amount: invoice.balanceDue ?? Math.max(0, invoice.total - invoice.amountPaid), method: 'manual' }),
      });
      setMessage('Invoice marked paid');
    });
  };

  const sendInvoice = async (invoice: FinanceInvoice) => {
    const toEmail = window.prompt('Send invoice to:', invoice.recipientEmail ?? invoice.customerEmail ?? '');
    if (!toEmail) return;
    await run(async () => {
      await apiRequest(`${basePath}/invoices/${invoice.id}/send`, {
        method: 'POST',
        body: JSON.stringify({ toEmail, baseUrl: window.location.origin }),
      });
      setMessage('Invoice sent');
    });
  };

  const downloadInvoice = async (invoice: FinanceInvoice) => {
    await run(async () => {
      await apiRequest(`${basePath}/invoices/${invoice.id}/generate-pdf`, { method: 'POST' });
      await downloadPdfBlob(`${basePath}/invoices/${invoice.id}/download-pdf`, `invoice-${invoice.number || invoice.id}.pdf`);
      setMessage('Invoice PDF downloaded');
    });
  };

  const copyPublicLink = async (invoice: FinanceInvoice) => {
    if (!invoice.publicToken) return;
    const url = `${window.location.origin}/invoice/public/${invoice.publicToken}`;
    await navigator.clipboard.writeText(url);
    setMessage('Public invoice link copied');
  };

  const removeCost = async (id: string) => {
    if (!window.confirm('Delete this cost?')) return;
    await run(() => apiRequest(`${basePath}/costs/${id}`, { method: 'DELETE' }));
  };

  const run = async (request: () => Promise<unknown>) => {
    setError('');
    setMessage('');
    try {
      await request();
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Finance action failed');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10"><DollarSign className="h-4 w-4 text-primary" /></div>
            <h1>{admin ? 'SaaS Finance' : 'Finance'}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{admin ? 'Track your SaaS invoices, payments, delayed collections, and provider costs.' : 'Manage invoices, payments, costs, and profitability for your own customers.'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
        </Button>
      </div>

      {(error || message) && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {error || message}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Total Invoiced" value={money(summary?.totalInvoiced)} />
        <Metric label="Paid" value={money(summary?.totalPaid)} />
        <Metric label="Overdue" value={money(summary?.overdue)} />
        <Metric label="Net Profit" value={money(summary?.netProfit)} />
      </div>

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-4 mt-4">
          <Card className="p-0">
            <CardHeader>
              <CardTitle className="text-base">Create Invoice</CardTitle>
              <CardDescription>Invoice-level discounts stay separate from client subscription discounts.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={createInvoice} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {admin && (
                  <Field label="Client">
                    <Select value={invoiceForm.tenantId || 'none'} onValueChange={value => setInvoiceForm(prev => ({ ...prev, tenantId: value === 'none' ? '' : value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {tenants.map(tenant => <SelectItem key={tenant.id} value={tenant.id}>{tenant.companyName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                <Field label="Customer"><Input required value={invoiceForm.customerName} onChange={event => setInvoiceForm(prev => ({ ...prev, customerName: event.target.value }))} /></Field>
                <Field label="Email"><Input type="email" value={invoiceForm.customerEmail} onChange={event => setInvoiceForm(prev => ({ ...prev, customerEmail: event.target.value }))} /></Field>
                <Field label="Line Item"><Input value={invoiceForm.itemName} onChange={event => setInvoiceForm(prev => ({ ...prev, itemName: event.target.value }))} /></Field>
                <Field label="Unit Price"><Input type="number" min="0" value={invoiceForm.unitPrice} onChange={event => setInvoiceForm(prev => ({ ...prev, unitPrice: event.target.value }))} /></Field>
                <Field label="Quantity"><Input type="number" min="1" value={invoiceForm.quantity} onChange={event => setInvoiceForm(prev => ({ ...prev, quantity: event.target.value }))} /></Field>
                <Field label="Discount Type">
                  <Select value={invoiceForm.discountType} onValueChange={value => setInvoiceForm(prev => ({ ...prev, discountType: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="percent">Percent</SelectItem><SelectItem value="fixed">Fixed</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field label="Discount"><Input type="number" min="0" value={invoiceForm.discountValue} onChange={event => setInvoiceForm(prev => ({ ...prev, discountValue: event.target.value }))} /></Field>
                <Field label="Due Date"><Input type="date" value={invoiceForm.dueDate} onChange={event => setInvoiceForm(prev => ({ ...prev, dueDate: event.target.value }))} /></Field>
                <Field label="PDF Template">
                  <Select value={invoiceForm.templateId} onValueChange={value => setInvoiceForm(prev => ({ ...prev, templateId: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="modern">Modern — Bold & colorful</SelectItem>
                      <SelectItem value="classic">Classic — Formal & structured</SelectItem>
                      <SelectItem value="minimal">Minimal — Clean & spacious</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="md:col-span-4 space-y-1.5">
                  <Label>Notes</Label>
                  <Textarea value={invoiceForm.notes} onChange={event => setInvoiceForm(prev => ({ ...prev, notes: event.target.value }))} />
                </div>
                <div className="md:col-span-4"><Button type="submit"><Plus className="h-3.5 w-3.5 mr-1.5" />Create Invoice</Button></div>
              </form>
            </CardContent>
          </Card>
          <RecordTable
            columns={['Invoice', 'Customer', 'Status', 'Total', 'Paid', 'Actions']}
            empty={loading ? 'Loading invoices...' : 'No invoices yet'}
            rows={invoices.map(invoice => [
              invoice.number,
              invoice.recipientName ?? invoice.customerName ?? '-',
              invoice.status,
              money(invoice.total),
              money(invoice.amountPaid),
              <div key={invoice.id} className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" title="Download PDF" onClick={() => void downloadInvoice(invoice)}><Download className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" title="Send invoice" onClick={() => void sendInvoice(invoice)}><Mail className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" title="Copy public link" onClick={() => void copyPublicLink(invoice)}><Copy className="h-3.5 w-3.5" /></Button>
                {invoice.status !== 'paid' && <Button size="sm" variant="outline" onClick={() => void markPaid(invoice)}>Paid</Button>}
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => void removeInvoice(invoice.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>,
            ])}
          />
        </TabsContent>

        <TabsContent value="payments" className="space-y-4 mt-4">
          <Card className="p-0">
            <CardHeader><CardTitle className="text-base">Record Payment</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={createPayment} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Field label="Invoice">
                  <Select value={paymentForm.invoiceId || 'none'} onValueChange={value => setPaymentForm(prev => ({ ...prev, invoiceId: value === 'none' ? '' : value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No invoice</SelectItem>
                      {unpaidInvoices.map(invoice => <SelectItem key={invoice.id} value={invoice.id}>{invoice.number} · {invoice.customerName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Amount"><Input required type="number" min="0" value={paymentForm.amount} onChange={event => setPaymentForm(prev => ({ ...prev, amount: event.target.value }))} /></Field>
                <Field label="Method"><Input value={paymentForm.method} onChange={event => setPaymentForm(prev => ({ ...prev, method: event.target.value }))} /></Field>
                <Field label="Status">
                  <Select value={paymentForm.status} onValueChange={value => setPaymentForm(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="received">Received</SelectItem><SelectItem value="delayed">Delayed</SelectItem><SelectItem value="failed">Failed</SelectItem></SelectContent>
                  </Select>
                </Field>
                <div className="md:col-span-4"><Button type="submit"><Plus className="h-3.5 w-3.5 mr-1.5" />Record Payment</Button></div>
              </form>
            </CardContent>
          </Card>
          <RecordTable
            columns={['Payment', 'Invoice', 'Method', 'Status', 'Paid At']}
            empty={loading ? 'Loading payments...' : 'No payments yet'}
            rows={payments.map(payment => [money(payment.amount), payment.invoice?.number ?? 'Unlinked', payment.method ?? '-', payment.status, new Date(payment.paidAt).toLocaleDateString()])}
          />
        </TabsContent>

        <TabsContent value="costs" className="space-y-4 mt-4">
          <Card className="p-0">
            <CardHeader><CardTitle className="text-base">Record Cost</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={createCost} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {admin && (
                  <Field label="Client">
                    <Select value={costForm.tenantId || 'none'} onValueChange={value => setCostForm(prev => ({ ...prev, tenantId: value === 'none' ? '' : value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {tenants.map(tenant => <SelectItem key={tenant.id} value={tenant.id}>{tenant.companyName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                <Field label="Vendor"><Input required value={costForm.vendor} onChange={event => setCostForm(prev => ({ ...prev, vendor: event.target.value }))} /></Field>
                <Field label="Category"><Input value={costForm.category} onChange={event => setCostForm(prev => ({ ...prev, category: event.target.value }))} /></Field>
                <Field label="Amount"><Input required type="number" min="0" value={costForm.amount} onChange={event => setCostForm(prev => ({ ...prev, amount: event.target.value }))} /></Field>
                <Field label="Status">
                  <Select value={costForm.status} onValueChange={value => setCostForm(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="unpaid">Unpaid</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="delayed">Delayed</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent>
                  </Select>
                </Field>
                <div className="md:col-span-4"><Button type="submit"><Plus className="h-3.5 w-3.5 mr-1.5" />Record Cost</Button></div>
              </form>
            </CardContent>
          </Card>
          <RecordTable
            columns={['Vendor', 'Category', 'Amount', 'Status', 'Actions']}
            empty={loading ? 'Loading costs...' : 'No costs yet'}
            rows={costs.map(cost => [
              cost.vendor,
              cost.category ?? '-',
              money(cost.amount),
              cost.status,
              <Button key={cost.id} size="sm" variant="outline" className="text-destructive" onClick={() => void removeCost(cost.id)}><Trash2 className="h-3.5 w-3.5" /></Button>,
            ])}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card className="p-0"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{value}</p></CardContent></Card>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function RecordTable({ columns, rows, empty }: { columns: string[]; rows: ReactNode[][]; empty: string }) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/30 border-b border-border"><tr>{columns.map(column => <th key={column} className="px-4 py-3 text-left text-xs text-muted-foreground">{column}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3 text-sm">{cell}</td>)}</tr>)}
          </tbody>
        </table>
        {rows.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">{empty}</div>}
      </div>
    </Card>
  );
}

function money(value = 0) {
  return `$${Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function normalizeSummary(summary: FinanceSummary): FinanceSummary {
  return Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, Number(value)])) as unknown as FinanceSummary;
}

function normalizeInvoice(invoice: FinanceInvoice): FinanceInvoice {
  return {
    ...invoice,
    recipientName: invoice.recipientName ?? invoice.customerName,
    recipientEmail: invoice.recipientEmail ?? invoice.customerEmail,
    total: Number(invoice.total),
    amountPaid: Number(invoice.amountPaid),
    balanceDue: Number(invoice.balanceDue ?? Math.max(0, Number(invoice.total) - Number(invoice.amountPaid))),
  };
}

function normalizePayment(payment: FinancePayment): FinancePayment {
  return { ...payment, amount: Number(payment.amount) };
}

function normalizeCost(cost: FinanceCost): FinanceCost {
  return { ...cost, amount: Number(cost.amount) };
}
