import { useParams, Link, useNavigate } from 'react-router';
import { useData } from '../../contexts/DataContext';
import { ArrowLeft, Mail, Eye, MousePointerClick, Users, Calendar } from 'lucide-react';

export function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { campaigns, addCampaign, updateCampaign, deleteCampaign, sendCampaignNow } = useData();
  
  const campaign = campaigns.find(c => c.id === id);

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
    sent: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  const duplicateCampaign = () => {
    addCampaign({
      name: `${campaign.name} Copy`,
      subject: campaign.subject,
      fromName: campaign.fromName,
      fromEmail: campaign.fromEmail,
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
    });
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
          </div>

          {/* Email Preview */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Email Preview</h2>
            </div>
            <div className="p-6">
              <div className="border-2 border-gray-200 rounded-lg p-6 bg-gray-50">
                <div className="bg-white rounded shadow-sm p-6 max-w-2xl mx-auto">
                  <div className="mb-6 pb-4 border-b border-gray-200">
                    <p className="text-sm text-gray-500 mb-1">Subject:</p>
                    <p className="font-semibold text-gray-900">{campaign.subject}</p>
                  </div>
                  <div className="prose max-w-none">
                    <p className="text-gray-700 mb-4">
                      Hi there,
                    </p>
                    <p className="text-gray-700 mb-4">
                      We're excited to share some amazing updates with you!
                    </p>
                    <p className="text-gray-700 mb-4">
                      [Email content would be displayed here with full HTML rendering]
                    </p>
                    <div className="mt-6">
                <button onClick={() => window.open(`/campaigns/${campaign.id}`, '_blank')} className="px-6 py-3 bg-blue-600 text-white rounded-lg">
                        Learn More
                      </button>
                    </div>
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
              <div className="space-y-2">
                <button onClick={() => sendCampaignNow(campaign.id)} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Send Now
                </button>
                <button onClick={() => updateCampaign(campaign.id, {
                  status: 'scheduled',
                  scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                })} className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
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
    </div>
  );
}
