import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, CheckCircle2, Clock, Copy, Download, Eye, FileText, Pencil, Send, XCircle } from 'lucide-react';
import { apiRequest, downloadPdfBlob } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { ProposalStatusBadge } from './components/ProposalStatusBadge';
import { ProposalProfitCard } from './components/ProposalProfitCard';
import { useAuth } from '../../contexts/AuthContext';

interface Activity {
  id: string;
  eventType: string;
  actorType: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface Service {
  id: string;
  serviceType: string;
  planName: string;
  listPrice: number;
  discountPercentage: number;
  finalPrice: number;
  features: string[];
  mccBaseCost?: number;
  creatorMargin?: number;
}

interface Proposal {
  id: string;
  proposalNumber?: string;
  title: string;
  recipientName: string;
  recipientEmail?: string;
  companyName?: string;
  status: string;
  billingCycle: string;
  contractDuration?: string;
  paymentTerms?: string;
  setupFee: number;
  subtotal: number;
  discountAmount: number;
  total: number;
  mccCostAmount?: number;
  creatorProfitAmount?: number;
  validUntil?: string;
  customIntroMessage?: string;
  pdfUrl?: string;
  sentAt?: string;
  viewedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  createdAt: string;
  services: Service[];
  activities: Activity[];
}

const activityIcons: Record<string, typeof FileText> = {
  created: FileText,
  sent: Send,
  viewed: Eye,
  accepted: CheckCircle2,
  rejected: XCircle,
  downloaded: Download,
  follow_up_sent: Clock,
};

export function ProposalDetail({ admin = false }: { admin?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const basePath = admin ? '/admin/proposals' : '/proposals';
  const listPath = admin ? '/mcc/proposals' : '/proposals';
  const isCreator = user?.role === 'superadmin' ? admin : true;

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<Proposal>(`${basePath}/${id}`);
      setProposal({
        ...data,
        subtotal: Number(data.subtotal),
        discountAmount: Number(data.discountAmount),
        total: Number(data.total),
        setupFee: Number(data.setupFee),
        mccCostAmount: data.mccCostAmount ? Number(data.mccCostAmount) : undefined,
        creatorProfitAmount: data.creatorProfitAmount ? Number(data.creatorProfitAmount) : undefined,
        services: (data.services ?? []).map((s) => ({
          ...s,
          listPrice: Number(s.listPrice),
          discountPercentage: Number(s.discountPercentage),
          finalPrice: Number(s.finalPrice),
          mccBaseCost: s.mccBaseCost ? Number(s.mccBaseCost) : undefined,
          creatorMargin: s.creatorMargin ? Number(s.creatorMargin) : undefined,
        })),
      });
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proposal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [id, admin]);

  const handleGeneratePdf = async () => {
    await apiRequest(`${basePath}/${id}/generate-pdf`, { method: 'POST' });
    await downloadPdfBlob(`${basePath}/${id}/download-pdf`, `proposal-${id}.pdf`);
    await load();
  };

  const handleDuplicate = async () => {
    const dup = await apiRequest<{ id: string }>(`${basePath}/${id}/duplicate`, { method: 'POST' });
    navigate(`${listPath}/${dup.id}`);
  };

  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>;
  if (!proposal) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <button onClick={() => navigate(listPath)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-1">
            <ArrowLeft className="h-3.5 w-3.5" />Back to Proposals
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{proposal.title}</h1>
            <ProposalStatusBadge status={proposal.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {proposal.proposalNumber && <span className="font-mono">{proposal.proposalNumber}</span>}
            {proposal.proposalNumber && ' · '}
            {proposal.recipientName}
            {proposal.companyName && ` · ${proposal.companyName}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`${listPath}/${id}/edit`)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleDuplicate()}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />Duplicate
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleGeneratePdf()}>
            <Download className="h-3.5 w-3.5 mr-1.5" />Download PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Services */}
          <Card>
            <CardHeader><CardTitle className="text-base">Services</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {proposal.services.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="font-medium text-sm capitalize">{s.serviceType.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground">{s.planName} Plan</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${s.finalPrice.toLocaleString()}</p>
                      {s.discountPercentage > 0 && (
                        <p className="text-xs text-emerald-600">-{s.discountPercentage}% off</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader><CardTitle className="text-base">Pricing</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${proposal.subtotal.toLocaleString()}</span></div>
              {proposal.discountAmount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-${proposal.discountAmount.toLocaleString()}</span></div>}
              {proposal.setupFee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Setup Fee</span><span>${proposal.setupFee.toLocaleString()}</span></div>}
              <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total</span><span className="text-primary">${proposal.total.toLocaleString()}</span></div>
              <div className="text-xs text-muted-foreground mt-2">
                {proposal.billingCycle && <span>Billed {proposal.billingCycle}</span>}
                {proposal.contractDuration && <span> · {proposal.contractDuration}</span>}
                {proposal.paymentTerms && <span> · {proposal.paymentTerms}</span>}
              </div>
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card>
            <CardHeader><CardTitle className="text-base">Activity</CardTitle></CardHeader>
            <CardContent>
              {proposal.activities?.length > 0 ? (
                <div className="space-y-3">
                  {proposal.activities.map((a) => {
                    const Icon = activityIcons[a.eventType] ?? Clock;
                    return (
                      <div key={a.id} className="flex items-start gap-3">
                        <div className="mt-0.5 p-1.5 rounded-full bg-muted"><Icon className="h-3.5 w-3.5 text-muted-foreground" /></div>
                        <div>
                          <p className="text-sm font-medium capitalize">{a.eventType.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.actorType} · {new Date(a.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          {/* Details Card */}
          <Card>
            <CardHeader><CardTitle className="text-sm text-muted-foreground">Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {proposal.validUntil && <div><span className="text-muted-foreground">Valid Until:</span> <span>{new Date(proposal.validUntil).toLocaleDateString()}</span></div>}
              {proposal.sentAt && <div><span className="text-muted-foreground">Sent:</span> <span>{new Date(proposal.sentAt).toLocaleDateString()}</span></div>}
              {proposal.viewedAt && <div><span className="text-muted-foreground">Viewed:</span> <span>{new Date(proposal.viewedAt).toLocaleDateString()}</span></div>}
              {proposal.acceptedAt && <div><span className="text-muted-foreground">Accepted:</span> <span>{new Date(proposal.acceptedAt).toLocaleDateString()}</span></div>}
              {proposal.rejectedAt && <div><span className="text-muted-foreground">Rejected:</span> <span>{new Date(proposal.rejectedAt).toLocaleDateString()}</span></div>}
              <div><span className="text-muted-foreground">Created:</span> <span>{new Date(proposal.createdAt).toLocaleDateString()}</span></div>
            </CardContent>
          </Card>

          {/* Profit Card (creator only) */}
          {isCreator && proposal.mccCostAmount !== undefined && proposal.creatorProfitAmount !== undefined && (
            <ProposalProfitCard
              totalRevenue={proposal.total}
              totalCost={proposal.mccCostAmount}
              totalProfit={proposal.creatorProfitAmount}
              avgMargin={proposal.total > 0 ? Math.round((proposal.creatorProfitAmount / proposal.total) * 100) : 0}
            />
          )}
        </div>
      </div>
    </div>
  );
}
