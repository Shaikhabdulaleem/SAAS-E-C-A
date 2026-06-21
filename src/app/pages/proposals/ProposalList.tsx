import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Copy, Download, Eye, FileText, MoreHorizontal, Pencil, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import { apiRequest, downloadPdfBlob } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { ProposalStatsBar } from './components/ProposalStatsBar';
import { ProposalStatusBadge } from './components/ProposalStatusBadge';
import { ProposalFilters } from './components/ProposalFilters';

interface Proposal {
  id: string;
  proposalNumber?: string;
  title: string;
  recipientName: string;
  recipientEmail?: string;
  companyName?: string;
  status: string;
  total: number;
  billingCycle: string;
  sentAt?: string;
  createdAt: string;
  services: Array<{ serviceType: string; planName: string; finalPrice: number }>;
}

interface ListResponse {
  items: Proposal[];
  total: number;
  page: number;
  pageSize: number;
}

export function ProposalList({ admin = false }: { admin?: boolean }) {
  const navigate = useNavigate();
  const [data, setData] = useState<ListResponse>({ items: [], total: 0, page: 1, pageSize: 50 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const basePath = admin ? '/admin/proposals' : '/proposals';
  const createPath = admin ? '/mcc/proposals/create' : '/proposals/create';
  const detailBase = admin ? '/mcc/proposals' : '/proposals';

  const stats = useMemo(() => {
    const items = data.items;
    return {
      total: data.total,
      draft: items.filter((p) => p.status === 'draft').length,
      sent: items.filter((p) => p.status === 'sent').length,
      viewed: items.filter((p) => p.status === 'viewed').length,
      accepted: items.filter((p) => p.status === 'accepted').length,
      rejected: items.filter((p) => p.status === 'rejected').length,
    };
  }, [data]);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const result = await apiRequest<ListResponse>(`${basePath}?${params}`);
      setData(result);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proposals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [search, statusFilter, admin]);

  const handleDuplicate = async (id: string) => {
    await apiRequest(`${basePath}/${id}/duplicate`, { method: 'POST' });
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this proposal?')) return;
    await apiRequest(`${basePath}/${id}`, { method: 'DELETE' });
    await load();
  };

  const handleGeneratePdf = async (id: string) => {
    await apiRequest(`${basePath}/${id}/generate-pdf`, { method: 'POST' });
    await downloadPdfBlob(`${basePath}/${id}/download-pdf`, `proposal-${id}.pdf`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10"><FileText className="h-4 w-4 text-primary" /></div>
            <h1 className="text-xl font-semibold">{admin ? 'SaaS Proposals' : 'Proposals'}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {admin ? 'Create and manage SaaS sales proposals for clients.' : 'Create professional proposals for your customers.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
          </Button>
          <Button size="sm" onClick={() => navigate(createPath)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />New Proposal
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <ProposalStatsBar {...stats} />

      <ProposalFilters
        search={search}
        status={statusFilter}
        onSearchChange={setSearch}
        onStatusChange={setStatusFilter}
      />

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-medium">#</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-medium">Proposal</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-medium">Recipient</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-medium">Services</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-medium">Value</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-medium">Status</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-medium">Date</th>
                <th className="px-4 py-3 text-right text-xs text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((proposal) => (
                <tr key={proposal.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => navigate(`${detailBase}/${proposal.id}`)}>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{proposal.proposalNumber ?? '—'}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{proposal.title}</p>
                    <p className="text-xs text-muted-foreground">{proposal.companyName || 'No company'}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">{proposal.recipientName}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {proposal.services?.slice(0, 3).map((s, i) => (
                        <span key={i} className="inline-flex rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          {s.serviceType.replace(/_/g, ' ')}
                        </span>
                      ))}
                      {(proposal.services?.length ?? 0) > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{proposal.services.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold">${Number(proposal.total).toLocaleString()}</td>
                  <td className="px-4 py-3"><ProposalStatusBadge status={proposal.status} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(proposal.sentAt ?? proposal.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`${detailBase}/${proposal.id}`)}>
                          <Eye className="h-3.5 w-3.5 mr-2" />View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`${detailBase}/${proposal.id}/edit`)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" />Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void handleDuplicate(proposal.id)}>
                          <Copy className="h-3.5 w-3.5 mr-2" />Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void handleGeneratePdf(proposal.id)}>
                          <Download className="h-3.5 w-3.5 mr-2" />Download PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => void handleDelete(proposal.id)}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && data.items.length === 0 && (
            <div className="py-16 text-center">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No proposals yet</p>
              <Button size="sm" className="mt-3" onClick={() => navigate(createPath)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />Create Your First Proposal
              </Button>
            </div>
          )}
          {loading && <div className="py-12 text-center text-sm text-muted-foreground">Loading proposals...</div>}
        </div>
      </Card>
    </div>
  );
}
