import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { BarChart2, Mail, Eye, MousePointerClick, AlertTriangle, UserMinus, TrendingUp } from 'lucide-react';
import { apiRequest } from '../../lib/api';

type AggregateData = {
  campaignCount: number;
  totalSent: number;
  totalOpens: number;
  totalClicks: number;
  totalBounces: number;
  totalUnsubs: number;
  avgOpenRate: number;
  avgClickRate: number;
  avgBounceRate: number;
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    totalRecipients: number;
    openRate: number;
    clickRate: number;
    sentAt: string | null;
  }>;
};

export function EmailAnalytics() {
  const [data, setData] = useState<AggregateData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<AggregateData>('/email/campaigns/aggregate-analytics')
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Unable to load analytics'));
  }, []);

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!data) return <div className="p-8 text-gray-500">Loading analytics...</div>;

  const metrics = [
    { label: 'Campaigns Sent', value: data.campaignCount, icon: Mail, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total Delivered', value: data.totalSent.toLocaleString(), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Avg Open Rate', value: `${(data.avgOpenRate * 100).toFixed(1)}%`, icon: Eye, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Avg Click Rate', value: `${(data.avgClickRate * 100).toFixed(1)}%`, icon: MousePointerClick, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Avg Bounce Rate', value: `${(data.avgBounceRate * 100).toFixed(1)}%`, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Unsubscribes', value: data.totalUnsubs.toLocaleString(), icon: UserMinus, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BarChart2 className="h-6 w-6 text-indigo-600" />
        <h1 className="text-2xl font-semibold text-gray-900">Email Analytics</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metrics.map(m => (
          <div key={m.label} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${m.bg}`}><m.icon className={`h-4 w-4 ${m.color}`} /></div>
              <span className="text-xs text-gray-500">{m.label}</span>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Campaign Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="px-6 py-3">Campaign</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Recipients</th>
                <th className="px-6 py-3 text-right">Open Rate</th>
                <th className="px-6 py-3 text-right">Click Rate</th>
                <th className="px-6 py-3 text-right">Sent</th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map(c => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <Link to={`/campaigns/${c.id}`} className="text-blue-600 hover:underline font-medium">{c.name}</Link>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'sent' ? 'bg-green-100 text-green-800' : c.status === 'sending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">{c.totalRecipients.toLocaleString()}</td>
                  <td className="px-6 py-3 text-right font-medium">{(c.openRate * 100).toFixed(1)}%</td>
                  <td className="px-6 py-3 text-right font-medium">{(c.clickRate * 100).toFixed(1)}%</td>
                  <td className="px-6 py-3 text-right text-gray-500">{c.sentAt ? new Date(c.sentAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
