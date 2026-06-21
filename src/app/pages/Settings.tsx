import { useEffect, useState } from 'react';
import { User, Building2, Bell, Lock, CreditCard, Users, Mail, Puzzle } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useTenants } from '../contexts/TenantContext';

export function Settings() {
  const { user } = useAuth();
  const { selectedTenant, updateTenant } = useTenants();
  const [activeTab, setActiveTab] = useState('profile');
  const [notice, setNotice] = useState('');
  const [organization, setOrganization] = useState({
    companyName: selectedTenant?.companyName ?? user?.tenantName ?? 'Your Organization',
    industry: selectedTenant?.industry ?? 'Technology',
    website: '',
  });

  useEffect(() => {
    setOrganization(prev => ({
      ...prev,
      companyName: selectedTenant?.companyName ?? user?.tenantName ?? prev.companyName,
      industry: selectedTenant?.industry ?? prev.industry,
    }));
  }, [selectedTenant?.id, selectedTenant?.companyName, selectedTenant?.industry, user?.tenantName]);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3000);
  };

  const saveOrganization = () => {
    if (selectedTenant) {
      updateTenant(selectedTenant.id, {
        companyName: organization.companyName,
        industry: organization.industry,
      });
    }
    showNotice('Organization settings saved.');
  };

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'organization', name: 'Organization', icon: Building2 },
    { id: 'team', name: 'Team', icon: Users },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Security', icon: Lock },
    { id: 'billing', name: 'Billing', icon: CreditCard },
    { id: 'email', name: 'Email Settings', icon: Mail },
    { id: 'integrations', name: 'Integrations', icon: Puzzle },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">Manage your account and organization preferences</p>
      </div>
      {notice && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow">
            <nav className="p-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {activeTab === 'profile' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Profile Settings</h2>
                <p className="text-sm text-gray-600 mt-1">Manage your personal information</p>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-6 mb-6">
                  <div className="h-20 w-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-semibold">
                    {user?.initials ?? 'U'}
                  </div>
                  <div>
                    <button onClick={() => showNotice('Avatar upload is ready for a storage provider.')} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 mr-2">
                      Change Avatar
                    </button>
                    <button onClick={() => showNotice('Avatar removed locally.')} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg">
                      Remove
                    </button>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        First Name
                      </label>
                      <input
                        type="text"
                        defaultValue={user?.name.split(' ')[0] ?? ''}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        defaultValue={user?.name.split(' ').slice(1).join(' ') || ''}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      defaultValue={user?.email ?? ''}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Job Title
                    </label>
                    <input
                      type="text"
                      placeholder="Job title"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="Business phone"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <button onClick={() => showNotice('Profile settings API is ready to connect.')} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'organization' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Organization Settings</h2>
                <p className="text-sm text-gray-600 mt-1">Manage your organization details</p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Organization Name
                    </label>
                    <input
                      type="text"
                      value={organization.companyName}
                      onChange={(e) => setOrganization(prev => ({ ...prev, companyName: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Industry
                    </label>
                    <select value={organization.industry} onChange={(e) => setOrganization(prev => ({ ...prev, industry: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>Technology</option>
                      <option>SaaS</option>
                      <option>Consulting</option>
                      <option>E-commerce</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Size
                    </label>
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>1-10 employees</option>
                      <option>11-50 employees</option>
                      <option>51-200 employees</option>
                      <option>201-1000 employees</option>
                      <option>1000+ employees</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Website
                    </label>
                    <input
                      type="url"
                      value={organization.website}
                      onChange={(e) => setOrganization(prev => ({ ...prev, website: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <button onClick={saveOrganization} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
                  <p className="text-sm text-gray-600 mt-1">Manage your team and permissions</p>
                </div>
                <button onClick={() => showNotice('Invite flow is available through the team API.')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Invite Member
                </button>
              </div>
              <div className="divide-y divide-gray-200">
                {([] as Array<{ name: string; email: string; role: string; status: string }>).map((member, index) => (
                  <div key={index} className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{member.name}</p>
                        <p className="text-sm text-gray-500">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                        {member.role}
                      </span>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                        {member.status}
                      </span>
                      {member.role !== 'Owner' && (
                      <button onClick={() => showNotice(`Member menu opened for ${member.name}.`)} className="text-gray-400 hover:text-gray-600">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>
                <p className="text-sm text-gray-600 mt-1">Manage how you receive notifications</p>
              </div>
              <div className="p-6 space-y-6">
                {[
                  { title: 'Email Notifications', description: 'Receive email updates about your account activity' },
                  { title: 'Deal Updates', description: 'Get notified when deals move to new stages' },
                  { title: 'Campaign Reports', description: 'Receive campaign performance summaries' },
                  { title: 'Team Mentions', description: 'Get notified when someone mentions you' },
                  { title: 'Task Reminders', description: 'Receive reminders for upcoming tasks' },
                ].map((setting, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{setting.title}</p>
                      <p className="text-sm text-gray-500">{setting.description}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Subscription Plan</h2>
                  <p className="text-sm text-gray-600 mt-1">Manage your subscription and billing</p>
                </div>
                <div className="p-6">
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">No billing plan loaded</h3>
                        <p className="text-gray-600 mt-1">Connect Stripe billing to show subscription, seats, usage, and invoices.</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">API-backed</p>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button onClick={() => showNotice('Stripe checkout is available through the billing API.')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Open Billing
                      </button>
                    </div>
                  </div>
                  <div className="hidden">
                    <h3 className="font-semibold text-gray-900 mb-3">Plan Includes:</h3>
                    <ul className="space-y-2">
                      {[
                        'Unlimited contacts and companies',
                        'Unlimited email campaigns',
                        'AI Assistant with advanced features',
                        'Up to 10 team members',
                        'Advanced analytics and reporting',
                        'Priority support',
                      ].map((feature, index) => (
                        <li key={index} className="flex items-center gap-2 text-gray-700">
                          <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Payment Method</h2>
                </div>
                <div className="p-6">
                  <div className="p-4 border border-gray-200 rounded-lg text-sm text-gray-600">
                    No payment method loaded from billing API.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'email' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Email Settings</h2>
                <p className="text-sm text-gray-600 mt-1">Configure your email sending preferences</p>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default From Name
                  </label>
                  <input
                    type="text"
                    placeholder="Sender name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default From Email
                  </label>
                  <input
                    type="email"
                    placeholder="sender@yourdomain.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This email must be verified before you can send campaigns
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reply-To Email
                  </label>
                  <input
                    type="email"
                    placeholder="replies@yourdomain.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-3">Verified Domains</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="font-medium text-gray-900">No verified domains loaded</span>
                      </div>
                      <span className="text-sm text-gray-600">API-backed</span>
                    </div>
                  </div>
                  <button onClick={() => showNotice('Domain verification flow queued.')} className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium">
                    + Add Domain
                  </button>
                </div>
                <div className="pt-6 border-t border-gray-200">
                  <button onClick={() => showNotice('Email settings API is ready to connect.')} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'security' || activeTab === 'lock') && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Security Settings</h2>
                <p className="text-sm text-gray-600 mt-1">Manage your password and security options</p>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Change Password</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Current Password
                      </label>
                      <input
                        type="password"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button onClick={() => showNotice('Password update requires a backend account settings endpoint.')} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      Update Password
                    </button>
                  </div>
                </div>
                <div className="pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Two-Factor Authentication</p>
                      <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
                    </div>
                    <button onClick={() => showNotice('Two-factor setup requires a backend account settings endpoint.')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      Enable
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <IntegrationsTab />
          )}
        </div>
      </div>
    </div>
  );
}

interface IntegrationConfig {
  key: string;
  name: string;
  description: string;
  color: string;
  bg: string;
  fields: Array<{ name: string; label: string; type: 'text' | 'password' }>;
}

const INTEGRATION_CONFIGS: IntegrationConfig[] = [
  { key: 'apollo', name: 'Apollo.io', description: 'Find prospect emails by company, domain, or job title', color: 'text-indigo-600', bg: 'bg-indigo-50', fields: [{ name: 'apiKey', label: 'API Key', type: 'password' }] },
  { key: 'cloudflare', name: 'Cloudflare', description: 'DNS management for sending domains (SPF, DKIM, DMARC, MX)', color: 'text-orange-600', bg: 'bg-orange-50', fields: [{ name: 'apiKey', label: 'API Token', type: 'password' }] },
  { key: 'namecheap', name: 'Namecheap', description: 'Domain registration and nameserver management', color: 'text-red-600', bg: 'bg-red-50', fields: [{ name: 'apiKey', label: 'API Key', type: 'password' }, { name: 'apiUser', label: 'API User', type: 'text' }, { name: 'userName', label: 'Username', type: 'text' }, { name: 'clientIp', label: 'Whitelisted IP', type: 'text' }] },
  { key: 'porkbun', name: 'Porkbun', description: 'Domain registration with competitive pricing', color: 'text-pink-600', bg: 'bg-pink-50', fields: [{ name: 'apikey', label: 'API Key', type: 'password' }, { name: 'secretapikey', label: 'Secret API Key', type: 'password' }] },
  { key: 'dynadot', name: 'Dynadot', description: 'Domain registration and management', color: 'text-blue-600', bg: 'bg-blue-50', fields: [{ name: 'apiKey', label: 'API Key', type: 'password' }] },
  { key: 'godaddy', name: 'GoDaddy', description: 'Domain registration and DNS management', color: 'text-green-600', bg: 'bg-green-50', fields: [{ name: 'key', label: 'API Key', type: 'password' }, { name: 'secret', label: 'API Secret', type: 'password' }] },
];

function IntegrationsTab() {
  const [integrations, setIntegrations] = useState<Record<string, { maskedKey: string; connectedAt: string }>>({});
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    apiRequest<Array<{ platformKey: string; maskedKey: string; connectedAt: string }>>('/cold-email/integrations')
      .then(data => {
        const map: Record<string, any> = {};
        (Array.isArray(data) ? data : []).forEach(i => { map[i.platformKey] = i; });
        setIntegrations(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = async (config: IntegrationConfig) => {
    const formData = forms[config.key] ?? {};
    const hasAllFields = config.fields.every(f => formData[f.name]?.trim());
    if (!hasAllFields) return;
    setSaving(config.key);
    setMessages(m => ({ ...m, [config.key]: '' }));
    try {
      const credentials = config.fields.length === 1 ? formData[config.fields[0].name] : formData;
      await apiRequest('/cold-email/integrations', { method: 'POST', body: JSON.stringify({ platformKey: config.key, credentials }) });
      const data = await apiRequest<Array<{ platformKey: string; maskedKey: string; connectedAt: string }>>('/cold-email/integrations');
      const map: Record<string, any> = {};
      (Array.isArray(data) ? data : []).forEach(i => { map[i.platformKey] = i; });
      setIntegrations(map);
      setForms(f => ({ ...f, [config.key]: {} }));
      setMessages(m => ({ ...m, [config.key]: `${config.name} connected` }));
    } catch (err) {
      setMessages(m => ({ ...m, [config.key]: err instanceof Error ? err.message : 'Failed' }));
    } finally {
      setSaving(null);
    }
  };

  const handleDisconnect = async (config: IntegrationConfig) => {
    if (!window.confirm(`Disconnect ${config.name}?`)) return;
    try {
      await apiRequest(`/cold-email/integrations/${config.key}`, { method: 'DELETE' });
      setIntegrations(prev => { const n = { ...prev }; delete n[config.key]; return n; });
      setMessages(m => ({ ...m, [config.key]: 'Disconnected' }));
    } catch {}
  };

  const setField = (key: string, field: string, value: string) => {
    setForms(f => ({ ...f, [key]: { ...(f[key] ?? {}), [field]: value } }));
  };

  if (loading) return <p className="text-sm text-gray-500 py-8 text-center">Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Integrations</h2>
        <p className="text-sm text-gray-500">Connect domain registrars, DNS providers, and email enrichment services.</p>
      </div>
      {INTEGRATION_CONFIGS.map(config => {
        const connected = integrations[config.key];
        const formData = forms[config.key] ?? {};
        const msg = messages[config.key];
        return (
          <div key={config.key} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${config.bg}`}><Puzzle className={`h-5 w-5 ${config.color}`} /></div>
                <div>
                  <h3 className="font-medium text-gray-900">{config.name}</h3>
                  <p className="text-xs text-gray-500">{config.description}</p>
                </div>
              </div>
              {connected ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">Connected</span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Not Connected</span>
              )}
            </div>
            {connected ? (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-900">Key: <span className="font-mono text-gray-500">{connected.maskedKey}</span></p>
                  <p className="text-xs text-gray-500">Connected {new Date(connected.connectedAt).toLocaleDateString()}</p>
                </div>
                <button onClick={() => void handleDisconnect(config)} className="text-xs text-red-600 hover:underline">Disconnect</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className={`grid gap-2 ${config.fields.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {config.fields.map(f => (
                    <input key={f.name} type={f.type} placeholder={f.label} value={formData[f.name] ?? ''} onChange={e => setField(config.key, f.name, e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  ))}
                </div>
                <button onClick={() => void handleConnect(config)} disabled={saving === config.key || !config.fields.every(f => formData[f.name]?.trim())} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
                  {saving === config.key ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            )}
            {msg && <p className={`text-xs ${msg.includes('Failed') ? 'text-red-600' : 'text-emerald-600'}`}>{msg}</p>}
          </div>
        );
      })}
    </div>
  );
}
