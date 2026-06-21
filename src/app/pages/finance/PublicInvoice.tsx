import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { Download, Receipt } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';

interface ApiEnvelope<T> {
  data: T | null;
  error: { message: string } | null;
}

interface PublicInvoiceData {
  id: string;
  number: string;
  status: string;
  recipientName: string;
  recipientCompany?: string;
  recipientEmail?: string;
  issueDate: string;
  dueDate?: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  notes?: string;
  paymentInstructions?: string;
  lineItems: Array<{
    id: string;
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3002/api';

export function PublicInvoice() {
  const { token } = useParams();
  const [invoice, setInvoice] = useState<PublicInvoiceData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    void fetch(`${API_BASE}/public/invoices/${token}`)
      .then(async (response) => {
        const payload = await response.json() as ApiEnvelope<PublicInvoiceData>;
        if (!response.ok || payload.error || !payload.data) throw new Error(payload.error?.message ?? 'Invoice not found');
        setInvoice(payload.data);
      })
      .catch((error) => setError(error instanceof Error ? error.message : 'Invoice not found'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <PublicShell><p className="text-muted-foreground">Loading invoice...</p></PublicShell>;
  if (error || !invoice) return <PublicShell><p className="text-destructive">{error || 'Invoice not found'}</p></PublicShell>;

  return (
    <PublicShell>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">Invoice {invoice.number}</h1>
          </div>
          <p className="text-muted-foreground">Issued to {invoice.recipientName}</p>
        </div>
        <Button onClick={() => window.open(`${API_BASE}/public/invoices/${token}/download`, '_blank')}>
          <Download className="h-4 w-4 mr-2" />Download PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Metric label="Status" value={invoice.status} />
        <Metric label="Due Date" value={invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '-'} />
        <Metric label="Total" value={money(invoice.total, invoice.currency)} />
        <Metric label="Balance Due" value={money(invoice.balanceDue, invoice.currency)} />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground">Item</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground">Qty</th>
                <th className="px-4 py-3 text-right text-xs text-muted-foreground">Unit</th>
                <th className="px-4 py-3 text-right text-xs text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoice.lineItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.name}</div>
                    {item.description && <div className="text-xs text-muted-foreground">{item.description}</div>}
                  </td>
                  <td className="px-4 py-3">{item.quantity}</td>
                  <td className="px-4 py-3 text-right">{money(item.unitPrice, invoice.currency)}</td>
                  <td className="px-4 py-3 text-right">{money(item.total, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-5 ml-auto max-w-sm space-y-2">
        <TotalRow label="Subtotal" value={invoice.subtotal} currency={invoice.currency} />
        <TotalRow label="Discount" value={-invoice.discountAmount} currency={invoice.currency} />
        <TotalRow label="Tax" value={invoice.taxAmount} currency={invoice.currency} />
        <TotalRow label="Paid" value={-invoice.amountPaid} currency={invoice.currency} />
        <div className="flex items-center justify-between rounded-lg bg-primary/10 px-4 py-3 font-semibold text-primary">
          <span>Balance Due</span>
          <span>{money(invoice.balanceDue, invoice.currency)}</span>
        </div>
      </div>

      {(invoice.notes || invoice.paymentInstructions) && (
        <div className="grid md:grid-cols-2 gap-4 mt-5">
          {invoice.notes && <Card className="p-0"><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Notes</p>{invoice.notes}</CardContent></Card>}
          {invoice.paymentInstructions && <Card className="p-0"><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Payment Instructions</p>{invoice.paymentInstructions}</CardContent></Card>}
        </div>
      )}
    </PublicShell>
  );
}

function PublicShell({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-muted/30 px-4 py-8"><div className="mx-auto max-w-5xl">{children}</div></main>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card className="p-0"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold capitalize">{value}</p></CardContent></Card>;
}

function TotalRow({ label, value, currency }: { label: string; value: number; currency: string }) {
  if (!value) return null;
  return <div className="flex items-center justify-between px-4 py-1.5 text-sm"><span className="text-muted-foreground">{label}</span><span>{money(value, currency)}</span></div>;
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value ?? 0));
}
