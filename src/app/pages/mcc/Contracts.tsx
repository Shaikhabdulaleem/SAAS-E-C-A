import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { FileSignature, Plus, Pencil, Trash2, AlertCircle, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationPrevious, PaginationNext, PaginationEllipsis,
} from '../../components/ui/pagination';

interface Contract {
  id: string;
  tenantId: string;
  companyName: string;
  title: string;
  contractType: string;
  status: string;
  value: number;
  startDate: string;
  endDate: string;
  terms: string;
  documentUrl: string;
  notes: string;
  createdAt: string;
}

interface PaginatedContracts {
  items: Contract[];
  pagination: { page: number; pageSize: number; total: number };
}

interface Tenant {
  id: string;
  companyName: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 border-gray-200',
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  expired: 'bg-amber-100 text-amber-800 border-amber-200',
  terminated: 'bg-red-100 text-red-800 border-red-200',
};

const CONTRACT_TYPES = ['retainer', 'project', 'subscription', 'one-time'];
const CONTRACT_STATUSES = ['draft', 'active', 'expired', 'terminated'];

const emptyForm = () => ({
  tenantId: '',
  title: '',
  contractType: 'retainer',
  status: 'draft',
  value: 0,
  startDate: '',
  endDate: '',
  terms: '',
  documentUrl: '',
  notes: '',
});

function buildPaginationPages(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | 'ellipsis')[] = [1];
  if (current > 3) pages.push('ellipsis');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push('ellipsis');
  pages.push(total);
  return pages;
}

export function Contracts() {
  const [data, setData] = useState<PaginatedContracts | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expiringCount, setExpiringCount] = useState(0);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const fetchContracts = () => {
    setLoading(true);
    setError(null);
    apiRequest<PaginatedContracts>(`/admin/contracts?page=${page}`)
      .then((res) => setData(res))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load contracts'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchContracts();
  }, [page]);

  useEffect(() => {
    apiRequest<{ count: number }>('/admin/contracts/expiring')
      .then((res) => setExpiringCount(res.count))
      .catch(() => {});
    apiRequest<Tenant[]>('/admin/tenants')
      .then((res) => setTenants(Array.isArray(res) ? res : []))
      .catch(() => {});
  }, []);

  const totalValue = data?.items.reduce((sum, c) => sum + (c.value || 0), 0) ?? 0;
  const activeCount = data?.items.filter((c) => c.status === 'active').length ?? 0;
  const totalPages = data ? Math.ceil(data.pagination.total / data.pagination.pageSize) : 0;
  const paginationPages = buildPaginationPages(page, totalPages);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (contract: Contract) => {
    setEditingId(contract.id);
    setForm({
      tenantId: contract.tenantId,
      title: contract.title,
      contractType: contract.contractType,
      status: contract.status,
      value: contract.value,
      startDate: contract.startDate?.slice(0, 10) ?? '',
      endDate: contract.endDate?.slice(0, 10) ?? '',
      terms: contract.terms ?? '',
      documentUrl: contract.documentUrl ?? '',
      notes: contract.notes ?? '',
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this contract?')) return;
    try {
      await apiRequest(`/admin/contracts/${id}`, { method: 'DELETE' });
      fetchContracts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = JSON.stringify(form);
      if (editingId) {
        await apiRequest(`/admin/contracts/${editingId}`, { method: 'PATCH', body });
      } else {
        await apiRequest('/admin/contracts', { method: 'POST', body });
      }
      setModalOpen(false);
      fetchContracts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileSignature className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Contracts</h1>
            <p className="text-sm text-muted-foreground">
              Manage client contracts, agreements, and renewals
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Contract
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-emerald-50">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-semibold">{loading ? '-' : activeCount}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Active Contracts</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-amber-50">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-semibold">{expiringCount}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Expiring Soon</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-indigo-50">
                <DollarSign className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-semibold">
                {loading ? '-' : `$${totalValue.toLocaleString()}`}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">Total Value</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {data ? `${data.pagination.total} contract${data.pagination.total !== 1 ? 's' : ''}` : 'Loading...'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Company</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Title</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Value</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Start</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">End</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-muted-foreground">
                      Loading contracts...
                    </td>
                  </tr>
                ) : data && data.items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-muted-foreground">
                      No contracts found.
                    </td>
                  </tr>
                ) : (
                  data?.items.map((contract) => (
                    <tr key={contract.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4">
                        <Link
                          to={`/mcc/tenants/${contract.tenantId}`}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {contract.companyName}
                        </Link>
                      </td>
                      <td className="py-3 px-4 font-medium">{contract.title}</td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {contract.contractType}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={`text-xs capitalize ${STATUS_COLORS[contract.status] ?? ''}`}
                        >
                          {contract.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        ${(contract.value || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                        {contract.startDate ? new Date(contract.startDate).toLocaleDateString() : '--'}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                        {contract.endDate ? new Date(contract.endDate).toLocaleDateString() : '--'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(contract)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(contract.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }}
                      className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      href="#"
                    />
                  </PaginationItem>
                  {paginationPages.map((p, i) =>
                    p === 'ellipsis' ? (
                      <PaginationItem key={`ellipsis-${i}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={p}>
                        <PaginationLink
                          onClick={(e) => { e.preventDefault(); setPage(p); }}
                          isActive={page === p}
                          href="#"
                          className="cursor-pointer"
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}
                  <PaginationItem>
                    <PaginationNext
                      onClick={(e) => { e.preventDefault(); if (page < totalPages) setPage(page + 1); }}
                      className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      href="#"
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Contract' : 'New Contract'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update contract details.' : 'Create a new client contract.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={form.tenantId} onValueChange={(val) => setForm((p) => ({ ...p, tenantId: val }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contract-title">Title</Label>
              <Input
                id="contract-title"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Contract title"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.contractType} onValueChange={(val) => setForm((p) => ({ ...p, contractType: val }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(val) => setForm((p) => ({ ...p, status: val }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contract-value">Value ($)</Label>
              <Input
                id="contract-value"
                type="number"
                value={form.value}
                onChange={(e) => setForm((p) => ({ ...p, value: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contract-start">Start Date</Label>
                <Input
                  id="contract-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contract-end">End Date</Label>
                <Input
                  id="contract-end"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contract-terms">Terms</Label>
              <Textarea
                id="contract-terms"
                value={form.terms}
                onChange={(e) => setForm((p) => ({ ...p, terms: e.target.value }))}
                placeholder="Contract terms and conditions..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contract-doc">Document URL</Label>
              <Input
                id="contract-doc"
                value={form.documentUrl}
                onChange={(e) => setForm((p) => ({ ...p, documentUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contract-notes">Notes</Label>
              <Textarea
                id="contract-notes"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Internal notes..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title.trim() || !form.tenantId}>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
