import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useData } from '../../contexts/DataContext';
import { ArrowLeft, Mail, Eye, MousePointerClick, Users, Calendar, AlertCircle, CheckCircle, Send, Copy, Pencil } from 'lucide-react';
import { apiRequest } from '../../lib/api';

type Recipient = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status: string;
  attempts: number;
  sentAt?: string;
  lastError?: string;
};

type CampaignAnalytics = {
  totalRecipients: number;
  sent: number;
  failed: number;
  queued: number;
  openCount: number;
  clickCount: number;
  bounceCount: number;
  unsubCount: number;
  openRate: number;
  clickRate: number;
};

type CampaignReadiness = {
  ready: boolean;
  checklist: Array<{ key: string; label: string; passed: boolean; blocking: boolean }>;
  blockingErrors: string[];
  warnings: string[];
  recipients: { total: number; suppressed: number; allowed: number };
  domain: { domain: string } | null;
};

export function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { campaigns, addCampaign, updateCampaign, deleteCampaign, sendCampaignNow, refreshData } = useData();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
  const [readiness, setReadiness] = useState<CampaignReadiness | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [followUpScheduledAt, setFollowUpScheduledAt] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', subject: '', fromName: '', fromEmail: '', replyToEmail: '', body: '', companyAddress: '' });
  const [selectedRecipient, setSelectedRecipient] = useState<{ id: string; email: string } | null>(null);
  const [timeline, setTimeline] = useState<any>(null);
  const [error, setError] = useState('');
  const [abResults, setAbResults] = useState<{ enabled: boolean; variants: Array<{ id: string; name: string; subject: string; recipients: number; sent: number; opens: number; clicks: number; openRate: number; clickRate: number }>; winnerId?: string } | null>(null);
  const [linkStats, setLinkStats] = useState<Array<{ url: string; totalClicks: number; uniqueClickers: number }>>([]);
  
  const campaign = campaigns.find(c => c.id === id);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiRequest<{ data: Recipient[]; total: number }>(`/email/campaigns/${id}/recipients?pageSize=50`).then(r => r.data ?? r).catch(() => []),
      apiRequest<CampaignAnalytics>(`/email/campaigns/${id}/analytics`),
      apiRequest<CampaignReadiness>(`/email/campaigns/${id}/readiness`),
      apiRequest<typeof abResults>(`/email/campaigns/${id}/ab-results`).catch(() => null),
      apiRequest<typeof linkStats>(`/email/campaigns/${id}/link-analytics`).catch(() => []),
    ])
      .then(([recipientData, analyticsData, readinessData, abData, linkData]) => {
        setRecipients(Array.isArray(recipientData) ? recipientData : []);
        setAnalytics(analyticsData);
        setReadiness(readinessData);
        setAbResults(abData);
        setLinkStats(Array.isArray(linkData) ? linkData : []);
        setError('');
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Unable to load campaign report'));
  }, [id, campaign?.status, campaign?.openCount, campaign?.clickCount]);

  useEffect(() => {
    if (!id || (campaign?.status !== 'sending' && campaign?.status !== 'paused')) return;
    const interval = setInterval(() => {
      apiRequest<CampaignAnalytics>(`/email/campaigns/${id}/analytics`).then(setAnalytics).catch(() => {});
      refreshData();
    }, 10000);
    return () => clearInterval(interval);
  }, [id, campaign?.status]);

  if (!campaign) {
    return <div>Campaign not found</div>;
  }

  const openRate = campaign.totalRecipients > 0 
    ? (campaign.openCount / campaign.totalRecipients) * 100 
    : 0;
  const clickRate = campaign.totalRecipients > 0
    ? (campaign.clickCount / campaign.totalRecipients) * 100
    : 0;
  const clickToOpenRate = campaign.openCount > 0
    ? (campaign.clickCount / campaign.openCount) * 100
    : 0;

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    scheduled: 'bg-blue-100 text-blue-800',
    sending: 'bg-yellow-100 text-yellow-800',
    paused: 'bg-purple-100 text-purple-800',
    sent: 'bg-green-100 text-green-800',
    partial_failed: 'bg-orange-100 text-orange-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  const duplicateCampaign = () => {
    addCampaign({
      name: `${campaign.name} Copy`,
      subject: campaign.subject,
      fromName: campaign.fromName,
      fromEmail: campaign.fromEmail,
      replyToEmail: campaign.replyToEmail,
      body: campaign.body,
      bodyPlainText: campaign.bodyPlainText,
      status: 'draft',
      totalRecipients: 0,
      openCount: 0,
      clickCount: 0,
      bounceCount: 0,
      unsubCount: 0,
      trackOpens: true,
      trackClicks: true,
      gdprConsent: false,
      doubleOptIn: false,
      companyAddress: campaign.companyAddress,
      recipientFilter: campaign.recipientFilter,
    });
  };

  const sendTest = async () => {
    if (!id || !testEmail.trim()) return;
    try {
      const result = await apiRequest<{ provider?: string }>(`/email/campaigns/${id}/send-test`, { method: 'POST', body: JSON.stringify({ to: testEmail.trim() }) });
      setNotice(result.provider === 'local'
        ? `Test email simulated locally for ${testEmail.trim()}`
        : `Test email sent to ${testEmail.trim()}`);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send test email');
    }
  };

  const createFollowUp = async (segment: 'openers' | 'clickers' | 'non_openers') => {
    if (!id) return;
    try {
      await apiRequest(`/email/campaigns/${id}/follow-up`, {
        method: 'POST',
        body: JSON.stringify({ segment, scheduledAt: followUpScheduledAt || undefined }),
      });
      await refreshData();
      setNotice(followUpScheduledAt ? `Follow-up scheduled for ${segment.replace('_', ' ')}` : `Follow-up draft created for ${segment.replace('_', ' ')}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create follow-up campaign');
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link to="/campaigns" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          Back to Campaigns
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">{campaign.name}</h1>
                  <p className="text-gray-600 mt-1">{campaign.subject}</p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[campaign.status]}`}>
                  {campaign.status}
                </span>
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  From: {campaign.fromName} &lt;{campaign.fromEmail}&gt;
                </div>
                {(campaign.sentAt || campaign.scheduledAt) && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {campaign.sentAt 
                      ? `Sent: ${new Date(campaign.sentAt).toLocaleString()}`
                      : `Scheduled: ${new Date(campaign.scheduledAt!).toLocaleString()}`
                    }
                  </div>
                )}
              </div>
            </div>

            {campaign.status === 'sent' && (
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h2>
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <Users className="h-5 w-5 text-blue-600" />
                      <span className="text-sm text-gray-600">Recipients</span>
                    </div>
                    <p className="text-3xl font-semibold text-gray-900">
                      {campaign.totalRecipients.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <Eye className="h-5 w-5 text-green-600" />
                      <span className="text-sm text-gray-600">Open Rate</span>
                    </div>
                    <p className="text-3xl font-semibold text-gray-900">{openRate.toFixed(1)}%</p>
                    <p className="text-sm text-gray-600 mt-1">{campaign.openCount} opens</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <MousePointerClick className="h-5 w-5 text-purple-600" />
                      <span className="text-sm text-gray-600">Click Rate</span>
                    </div>
                    <p className="text-3xl font-semibold text-gray-900">{clickRate.toFixed(1)}%</p>
                    <p className="text-sm text-gray-600 mt-1">{campaign.clickCount} clicks</p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <MousePointerClick className="h-5 w-5 text-orange-600" />
                      <span className="text-sm text-gray-600">Click-to-Open</span>
                    </div>
                    <p className="text-3xl font-semibold text-gray-900">{clickToOpenRate.toFixed(1)}%</p>
                    <p className="text-sm text-gray-600 mt-1">of those who opened</p>
                  </div>
                </div>
              </div>
            )}

            {campaign.status === 'sending' && (
              <div className="p-4 border-t border-blue-100 bg-blue-50 text-sm text-blue-800 flex gap-2">
                <Send className="h-4 w-4 mt-0.5 animate-pulse" />
                <span>
                  {campaign.lastError || `Sending in progress — ${analytics?.sent ?? 0}/${campaign.totalRecipients} delivered.`}
                  {(analytics?.queued ?? 0) > 0 && ' Sending is throttled to protect domain reputation. Remaining emails will be sent over the coming days.'}
                </span>
              </div>
            )}

            {campaign.status === 'partial_failed' && (
              <div className="p-4 border-t border-orange-100 bg-orange-50 text-sm text-orange-800 flex gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <span>{campaign.lastError || 'Some recipients failed. Review the recipient table below.'}</span>
              </div>
            )}

            {notice && (
              <div className="p-4 border-t border-emerald-100 bg-emerald-50 text-sm text-emerald-800 flex gap-2">
                <CheckCircle className="h-4 w-4 mt-0.5" />
                <span>{notice}</span>
              </div>
            )}
          </div>

          {readiness && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Review & Send Readiness</h2>
                <p className="text-sm text-gray-600 mt-1">{readiness.ready ? 'This campaign is ready to send.' : 'Resolve blocking items before sending.'}</p>
              </div>
              <div className="p-6 grid gap-3 md:grid-cols-2">
                {readiness.checklist.map(item => (
                  <div key={item.key} className="flex items-center justify-between rounded-lg border border-gray-200 p-3 text-sm">
                    <span className="flex items-center gap-2">
                      {item.passed ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}
                      {item.label}
                    </span>
                    {!item.passed && item.blocking && <span className="text-xs text-amber-700">Required</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* A/B Test Results */}
          {abResults?.enabled && abResults.variants.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">A/B Test Results</h2>
                {abResults.winnerId && <p className="text-sm text-emerald-600 mt-1">Winner: {abResults.variants.find(v => v.id === abResults.winnerId)?.name ?? abResults.winnerId}</p>}
              </div>
              <div className="p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  {abResults.variants.map(v => (
                    <div key={v.id} className={`p-4 rounded-lg border-2 ${v.id === abResults.winnerId ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-900">{v.name}</h3>
                        {v.id === abResults.winnerId && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Winner</span>}
                      </div>
                      <p className="text-sm text-gray-600 mb-3 truncate">Subject: {v.subject}</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div><p className="text-lg font-semibold text-gray-900">{v.sent}</p><p className="text-xs text-gray-500">Sent</p></div>
                        <div><p className="text-lg font-semibold text-blue-600">{(v.openRate * 100).toFixed(1)}%</p><p className="text-xs text-gray-500">Opens</p></div>
                        <div><p className="text-lg font-semibold text-purple-600">{(v.clickRate * 100).toFixed(1)}%</p><p className="text-xs text-gray-500">Clicks</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Link Analytics */}
          {linkStats.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Link Performance</h2>
              </div>
              <div className="p-6">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2">URL</th><th className="pb-2 text-right">Clicks</th><th className="pb-2 text-right">Unique</th></tr></thead>
                  <tbody>
                    {linkStats.slice(0, 10).map((link, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2 max-w-xs truncate text-blue-600">{link.url}</td>
                        <td className="py-2 text-right font-medium">{link.totalClicks}</td>
                        <td className="py-2 text-right text-gray-600">{link.uniqueClickers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Email Preview / Edit */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Campaign' : 'Email Preview'}</h2>
              {campaign.status === 'draft' && !editing && (
                <button onClick={() => { setEditing(true); setEditForm({ name: campaign.name, subject: campaign.subject, fromName: campaign.fromName, fromEmail: campaign.fromEmail, replyToEmail: campaign.replyToEmail || '', body: campaign.body || '', companyAddress: campaign.companyAddress || '' }); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-md">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              )}
            </div>
            <div className="p-6">
              {editing ? (
                <div className="space-y-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label><input className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Subject Line</label><input className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={editForm.subject} onChange={e => setEditForm(f => ({ ...f, subject: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">From Name</label><input className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={editForm.fromName} onChange={e => setEditForm(f => ({ ...f, fromName: e.target.value }))} /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">From Email</label><input className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={editForm.fromEmail} onChange={e => setEditForm(f => ({ ...f, fromEmail: e.target.value }))} /></div>
                  </div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Reply-To Email</label><input className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={editForm.replyToEmail} onChange={e => setEditForm(f => ({ ...f, replyToEmail: e.target.value }))} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Email Body (HTML)</label><textarea rows={10} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono" value={editForm.body} onChange={e => setEditForm(f => ({ ...f, body: e.target.value }))} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Company Address</label><input className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={editForm.companyAddress} onChange={e => setEditForm(f => ({ ...f, companyAddress: e.target.value }))} /></div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => { updateCampaign(campaign.id, editForm); setEditing(false); setNotice('Campaign updated.'); }} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">Save Changes</button>
                    <button onClick={() => setEditing(false)} className="px-4 py-2 border border-gray-300 text-sm rounded-md hover:bg-gray-50">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-gray-200 rounded-lg p-6 bg-gray-50">
                  <div className="bg-white rounded shadow-sm p-6 max-w-2xl mx-auto">
                    <div className="mb-6 pb-4 border-b border-gray-200">
                      <p className="text-sm text-gray-500 mb-1">Subject:</p>
                      <p className="font-semibold text-gray-900">{campaign.subject}</p>
                    </div>
                    <div className="prose max-w-none text-gray-700">
                      {campaign.body ? (
                        <div dangerouslySetInnerHTML={{ __html: campaign.body }} />
                      ) : (
                        <p>No campaign body has been saved yet.</p>
                      )}
                      <div className="mt-8 pt-6 border-t border-gray-200 text-xs text-gray-500">
                        <p>You're receiving this email because you subscribed to {campaign.fromName}.</p>
                        <p className="mt-2">
                          <a href="#" className="text-blue-600 hover:underline">Unsubscribe</a> |
                          <a href="#" className="text-blue-600 hover:underline ml-2">View in browser</a>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Test & Follow-Up</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <input className="h-10 flex-1 rounded-md border border-gray-300 px-3 text-sm" placeholder="test@example.com" value={testEmail} onChange={event => setTestEmail(event.target.value)} />
                <button className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white" onClick={sendTest}>
                  <Send className="h-4 w-4" />
                  Send Test
                </button>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="grid gap-2 sm:grid-cols-3">
                <button className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm" onClick={() => createFollowUp('openers')}><Copy className="h-4 w-4" /> Openers</button>
                <button className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm" onClick={() => createFollowUp('clickers')}><Copy className="h-4 w-4" /> Clickers</button>
                <button className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm" onClick={() => createFollowUp('non_openers')}><Copy className="h-4 w-4" /> Non-openers</button>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Optional follow-up schedule</label>
                <input className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" type="datetime-local" value={followUpScheduledAt} onChange={event => setFollowUpScheduledAt(event.target.value)} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recipients</h2>
              <button onClick={async () => {
                const result = await apiRequest<{ csv: string; campaignName: string }>(`/email/campaigns/${id}/export-csv`);
                const blob = new Blob([result.csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `${result.campaignName}-recipients.csv`; a.click();
                URL.revokeObjectURL(url);
              }} className="text-sm text-blue-600 hover:underline">Export CSV</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left px-6 py-3">Email</th>
                    <th className="text-left px-6 py-3">Status</th>
                    <th className="text-left px-6 py-3">Attempts</th>
                    <th className="text-left px-6 py-3">Sent</th>
                    <th className="text-left px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map(recipient => (
                    <tr key={recipient.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-3">{recipient.email}</td>
                      <td className="px-6 py-3 capitalize">{recipient.status.replace(/_/g, ' ')}</td>
                      <td className="px-6 py-3">{recipient.attempts}</td>
                      <td className="px-6 py-3">{recipient.sentAt ? new Date(recipient.sentAt).toLocaleString() : recipient.lastError || '-'}</td>
                      <td className="px-6 py-3"><button onClick={async () => {
                        setSelectedRecipient({ id: recipient.id, email: recipient.email });
                        const data = await apiRequest(`/email/campaigns/${id}/recipients/${recipient.id}/timeline`).catch(() => null);
                        setTimeline(data);
                      }} className="text-xs text-blue-600 hover:underline">Timeline</button></td>
                    </tr>
                  ))}
                  {!recipients.length && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No recipients queued yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Campaign Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Campaign Details</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="text-gray-900 font-medium capitalize">{campaign.status}</p>
              </div>
              {analytics && (
                <>
                  <div>
                    <p className="text-sm text-gray-500">Delivered</p>
                    <p className="text-gray-900">{analytics.sent} / {analytics.totalRecipients}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Failed</p>
                    <p className="text-gray-900">{analytics.failed}</p>
                  </div>
                </>
              )}
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="text-gray-900">{new Date(campaign.createdAt).toLocaleDateString()}</p>
              </div>
              {campaign.sentAt && (
                <div>
                  <p className="text-sm text-gray-500">Sent</p>
                  <p className="text-gray-900">{new Date(campaign.sentAt).toLocaleDateString()}</p>
                </div>
              )}
              {campaign.scheduledAt && !campaign.sentAt && (
                <div>
                  <p className="text-sm text-gray-500">Scheduled For</p>
                  <p className="text-gray-900">{new Date(campaign.scheduledAt).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          {campaign.status === 'draft' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
              {error && (
                <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 flex gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {readiness && !readiness.ready && (
                <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                  <p className="font-medium mb-1">Cannot send yet:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {readiness.blockingErrors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              <div className="space-y-2">
                <button
                  onClick={async () => {
                    setError('');
                    try {
                      await apiRequest(`/email/campaigns/${campaign.id}/send-now`, { method: 'POST' });
                      setNotice('Campaign is now sending!');
                      await refreshData();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Unable to send campaign');
                    }
                  }}
                  disabled={readiness !== null && !readiness.ready}
                  className={`w-full px-4 py-2 rounded-lg ${readiness && !readiness.ready ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  Send Now
                </button>
                <button onClick={() => {
                  apiRequest(`/email/campaigns/${campaign.id}/schedule`, {
                    method: 'POST',
                    body: JSON.stringify({ scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }),
                  }).then(() => refreshData()).catch(err => setError(err instanceof Error ? err.message : 'Unable to schedule campaign'));
                }} className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Schedule
                </button>
                <button onClick={duplicateCampaign} className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Duplicate Draft
                </button>
                <button onClick={() => {
                  if (window.confirm(`Delete ${campaign.name}?`)) {
                    deleteCampaign(campaign.id);
                    navigate('/campaigns');
                  }
                }} className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50">
                  Delete Campaign
                </button>
              </div>
            </div>
          )}

          {(campaign.status === 'sending' || campaign.status === 'paused' || campaign.status === 'partial_failed') && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Send Controls</h2>
              <div className="space-y-2">
                {campaign.status === 'sending' && (
                  <button onClick={async () => { try { await apiRequest(`/email/campaigns/${campaign.id}/pause`, { method: 'POST' }); setNotice('Campaign paused'); await refreshData(); } catch (err) { setError(err instanceof Error ? err.message : 'Failed to pause'); } }} className="w-full px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600">
                    Pause Sending
                  </button>
                )}
                {(campaign.status === 'paused' || campaign.status === 'partial_failed') && (
                  <button onClick={async () => { try { await apiRequest(`/email/campaigns/${campaign.id}/resume`, { method: 'POST' }); setNotice('Campaign resumed'); await refreshData(); } catch (err) { setError(err instanceof Error ? err.message : 'Failed to resume'); } }} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Resume Sending
                  </button>
                )}
              </div>
            </div>
          )}

          {campaign.status === 'sent' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Campaign Actions</h2>
              <div className="space-y-2">
                <button onClick={duplicateCampaign} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Duplicate Campaign
                </button>
                <button onClick={() => {
                  const csv = `name,subject,recipients,opens,clicks\n"${campaign.name}","${campaign.subject}",${campaign.totalRecipients},${campaign.openCount},${campaign.clickCount}`;
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `${campaign.name.replace(/\s+/g, '-').toLowerCase()}-results.csv`;
                  link.click();
                  URL.revokeObjectURL(url);
                }} className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Export Results
                </button>
                <button onClick={() => {
                  if (window.confirm(`Delete ${campaign.name}?`)) {
                    deleteCampaign(campaign.id);
                    navigate('/campaigns');
                  }
                }} className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50">
                  Delete Campaign
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recipient Timeline Modal */}
      {selectedRecipient && timeline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setSelectedRecipient(null); setTimeline(null); }}>
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Timeline: {selectedRecipient.email}</h3>
              <button onClick={() => { setSelectedRecipient(null); setTimeline(null); }} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="space-y-2">
              {timeline.events?.map((ev: any) => (
                <div key={ev.id} className="flex items-center gap-3 p-2 border-b border-gray-100 text-sm">
                  <span className={`w-2 h-2 rounded-full ${ev.type === 'delivered' ? 'bg-green-400' : ev.type === 'open' ? 'bg-blue-400' : ev.type === 'click' ? 'bg-purple-400' : ev.type === 'bounce' ? 'bg-red-400' : 'bg-gray-400'}`} />
                  <span className="capitalize font-medium">{ev.type.replace(/_/g, ' ')}</span>
                  {ev.url && <span className="text-xs text-gray-500 truncate max-w-[200px]">{ev.url}</span>}
                  <span className="ml-auto text-xs text-gray-400">{new Date(ev.occurredAt).toLocaleString()}</span>
                </div>
              ))}
              {(!timeline.events || timeline.events.length === 0) && <p className="text-sm text-gray-500">No events recorded.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
