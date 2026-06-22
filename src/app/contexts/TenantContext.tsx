import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiRequest, getSelectedTenantId, setAdminImpersonation } from '../lib/api';
import { useAuth } from './AuthContext';

export type ServiceKey = 'crm' | 'email_marketing' | 'cold_email' | 'ai_assistant' | 'analytics' | 'api_access' | 'proposals' | 'finance';

// ─── Integration platforms ────────────────────────────────────────────────────

export type IntegrationPlatformKey =
  | 'apollo' | 'hunter' | 'clearbit' | 'zoominfo' | 'lusha'
  | 'sendgrid' | 'mailchimp' | 'activecampaign' | 'postmark'
  | 'twilio' | 'aircall' | 'justcall'
  | 'hubspot' | 'salesforce' | 'pipedrive'
  | 'slack' | 'zapier' | 'custom';

export interface IntegrationPlatform {
  key: IntegrationPlatformKey;
  name: string;
  category: string;
  icon: string;
  color: string;
  bgColor: string;
  description: string;
  pricingUrl?: string;
}

export const INTEGRATION_PLATFORMS: IntegrationPlatform[] = [
  { key: 'apollo', name: 'Apollo.io', category: 'Lead Generation', icon: '🚀', color: 'text-orange-700', bgColor: 'bg-orange-50', description: 'B2B lead database & email sequencing', pricingUrl: 'https://apollo.io/pricing' },
  { key: 'hunter', name: 'Hunter.io', category: 'Email Finder', icon: '🎯', color: 'text-red-700', bgColor: 'bg-red-50', description: 'Find and verify email addresses', pricingUrl: 'https://hunter.io/pricing' },
  { key: 'clearbit', name: 'Clearbit', category: 'Data Enrichment', icon: '💎', color: 'text-sky-700', bgColor: 'bg-sky-50', description: 'Real-time B2B data enrichment', pricingUrl: 'https://clearbit.com/pricing' },
  { key: 'zoominfo', name: 'ZoomInfo', category: 'B2B Intelligence', icon: '🔍', color: 'text-blue-700', bgColor: 'bg-blue-50', description: 'Go-to-market intelligence platform', pricingUrl: 'https://zoominfo.com' },
  { key: 'lusha', name: 'Lusha', category: 'Contact Data', icon: '👤', color: 'text-violet-700', bgColor: 'bg-violet-50', description: 'B2B contact & company data', pricingUrl: 'https://lusha.com/pricing' },
  { key: 'sendgrid', name: 'SendGrid', category: 'Email Delivery', icon: '✉️', color: 'text-indigo-700', bgColor: 'bg-indigo-50', description: 'Transactional & marketing email delivery', pricingUrl: 'https://sendgrid.com/pricing' },
  { key: 'mailchimp', name: 'Mailchimp', category: 'Email Marketing', icon: '🐒', color: 'text-amber-700', bgColor: 'bg-amber-50', description: 'Email marketing & automation', pricingUrl: 'https://mailchimp.com/pricing' },
  { key: 'activecampaign', name: 'ActiveCampaign', category: 'Email Marketing', icon: '⚡', color: 'text-blue-700', bgColor: 'bg-blue-50', description: 'Email automation & CRM', pricingUrl: 'https://activecampaign.com/pricing' },
  { key: 'postmark', name: 'Postmark', category: 'Email Delivery', icon: '📬', color: 'text-yellow-700', bgColor: 'bg-yellow-50', description: 'Fast transactional email delivery', pricingUrl: 'https://postmarkapp.com/pricing' },
  { key: 'twilio', name: 'Twilio', category: 'SMS / Calling', icon: '📞', color: 'text-rose-700', bgColor: 'bg-rose-50', description: 'SMS, voice calls, and messaging APIs', pricingUrl: 'https://twilio.com/pricing' },
  { key: 'aircall', name: 'Aircall', category: 'Cloud Phone', icon: '📲', color: 'text-emerald-700', bgColor: 'bg-emerald-50', description: 'Cloud-based phone system for sales teams', pricingUrl: 'https://aircall.io/pricing' },
  { key: 'justcall', name: 'JustCall', category: 'Cloud Phone', icon: '☎️', color: 'text-teal-700', bgColor: 'bg-teal-50', description: 'Sales dialer & SMS platform', pricingUrl: 'https://justcall.io/pricing' },
  { key: 'hubspot', name: 'HubSpot', category: 'CRM', icon: '🧡', color: 'text-orange-700', bgColor: 'bg-orange-50', description: 'CRM, marketing, and sales platform', pricingUrl: 'https://hubspot.com/pricing' },
  { key: 'salesforce', name: 'Salesforce', category: 'CRM', icon: '☁️', color: 'text-blue-700', bgColor: 'bg-blue-50', description: 'Enterprise CRM platform', pricingUrl: 'https://salesforce.com/pricing' },
  { key: 'pipedrive', name: 'Pipedrive', category: 'CRM', icon: '🔧', color: 'text-green-700', bgColor: 'bg-green-50', description: 'Sales-focused CRM for SMBs', pricingUrl: 'https://pipedrive.com/pricing' },
  { key: 'slack', name: 'Slack', category: 'Communication', icon: '💬', color: 'text-purple-700', bgColor: 'bg-purple-50', description: 'Team messaging and notifications', pricingUrl: 'https://slack.com/pricing' },
  { key: 'zapier', name: 'Zapier', category: 'Automation', icon: '⚙️', color: 'text-orange-700', bgColor: 'bg-orange-50', description: 'Workflow automation & app integrations', pricingUrl: 'https://zapier.com/pricing' },
  { key: 'custom', name: 'Custom API', category: 'Custom', icon: '🔌', color: 'text-gray-700', bgColor: 'bg-gray-50', description: 'Custom third-party API integration' },
];

export interface TenantIntegration {
  id: string;
  platformKey: IntegrationPlatformKey;
  customName?: string;
  apiKey: string;
  monthlyPrice: number;
  isActive: boolean;
  addedAt: string;
  notes?: string;
}

export interface Service {
  key: ServiceKey;
  label: string;
  description: string;
  icon: string;
  monthlyPrice?: number;
  isActive?: boolean;
}

export const ALL_SERVICES: Service[] = [
  { key: 'crm', label: 'CRM', description: 'Contacts, companies, and deals pipeline', icon: '👥' },
  { key: 'email_marketing', label: 'Email Marketing', description: 'Campaigns, templates, and analytics', icon: '✉️' },
  { key: 'cold_email', label: 'Cold Outreach', description: 'Sequences, prospects, mailboxes, domains, warmup, health, and auto-provisioning', icon: '🎯' },
  { key: 'ai_assistant', label: 'AI Call Assistant', description: 'AI-powered sales coaching and call analysis', icon: '🤖' },
  { key: 'proposals', label: 'Proposals', description: 'Create, send, and track client-facing proposals', icon: 'PR' },
  { key: 'finance', label: 'Finance', description: 'Invoices, payments, costs, overdue tracking, and profit reporting', icon: 'FI' },
  { key: 'analytics', label: 'Advanced Analytics', description: 'Custom reports and data exports', icon: '📊' },
  { key: 'api_access', label: 'API Access', description: 'REST API and webhook integrations', icon: '🔌' },
];

export type PlanKey = 'starter' | 'growth' | 'business' | 'enterprise';

export interface Plan {
  key: PlanKey;
  label: string;
  price: number;
  billingCycle: 'monthly' | 'annual';
  services: ServiceKey[];
  color: string;
  bgColor: string;
  isActive?: boolean;
}

export const PLANS: Plan[] = [
  {
    key: 'starter', label: 'Starter', price: 49, billingCycle: 'monthly',
    services: ['crm'],
    color: 'text-sky-700', bgColor: 'bg-sky-50',
  },
  {
    key: 'growth', label: 'Growth', price: 149, billingCycle: 'monthly',
    services: ['crm', 'email_marketing', 'cold_email'],
    color: 'text-indigo-700', bgColor: 'bg-indigo-50',
  },
  {
    key: 'business', label: 'Business', price: 299, billingCycle: 'monthly',
    services: ['crm', 'email_marketing', 'cold_email', 'ai_assistant', 'proposals', 'analytics'],
    color: 'text-violet-700', bgColor: 'bg-violet-50',
  },
  {
    key: 'enterprise', label: 'Enterprise', price: 799, billingCycle: 'monthly',
    services: ['crm', 'email_marketing', 'cold_email', 'ai_assistant', 'proposals', 'finance', 'analytics', 'api_access'],
    color: 'text-emerald-700', bgColor: 'bg-emerald-50',
  },
];

export type TenantStatus = 'active' | 'trial' | 'onboarding' | 'payment_failed' | 'suspended' | 'cancelled';

export interface Tenant {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  industry?: string;
  plan: PlanKey;
  status: TenantStatus;
  enabledServices: ServiceKey[];
  seats: number;
  mrr: number;
  customPriceEnabled?: boolean;
  customMrr?: number;
  discountType?: 'none' | 'percent' | 'fixed';
  discountValue?: number;
  discountReason?: string;
  discountExpiresAt?: string;
  trialEndsAt?: string;
  createdAt: string;
  notes?: string;
  integrations: TenantIntegration[];
}

interface TenantContextType {
  tenants: Tenant[];
  services: Service[];
  plans: Plan[];
  selectedTenantId: string | null;
  selectedTenant: Tenant | null;
  apiError: string | null;
  selectTenant: (tenantId: string) => void;
  startImpersonation: (tenantId: string) => void;
  stopImpersonation: () => void;
  refreshTenants: () => Promise<void>;
  refreshPricing: () => Promise<void>;
  addTenant: (t: Omit<Tenant, 'id' | 'createdAt'>) => void;
  updateTenant: (id: string, updates: Partial<Tenant>) => void;
  deleteTenant: (id: string) => void;
  addIntegration: (tenantId: string, integration: Omit<TenantIntegration, 'id' | 'addedAt'>) => void;
  updateIntegration: (tenantId: string, integrationId: string, updates: Partial<TenantIntegration>) => void;
  removeIntegration: (tenantId: string, integrationId: string) => void;
  updateServicePricing: (key: ServiceKey, updates: Partial<Service>) => Promise<void>;
  updatePlanPricing: (key: PlanKey, updates: Partial<Plan>) => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, authVersion } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [services, setServices] = useState<Service[]>(ALL_SERVICES);
  const [plans, setPlans] = useState<Plan[]>(PLANS);
  const [selectedTenantId, setSelectedTenantIdState] = useState<string | null>(() => getSelectedTenantId());
  const [apiError, setApiError] = useState<string | null>(null);

  const selectTenant = (tenantId: string) => {
    setSelectedTenantIdState(tenantId);
    setAdminImpersonation(tenantId);
  };

  const startImpersonation = selectTenant;

  const stopImpersonation = () => {
    setSelectedTenantIdState(null);
    setAdminImpersonation(null);
  };

  const refreshTenants = async () => {
    if (!user) {
      setApiError(null);
      return;
    }

    if (user.role === 'client') {
      setSelectedTenantIdState(null);
      setAdminImpersonation(null);
      setApiError(null);
      return;
    }

    try {
      const data = await apiRequest<Tenant[]>('/admin/tenants');
      const normalized = data.map(normalizeTenant);
      setTenants(normalized);
      void refreshPricing().catch(() => {
        setServices(ALL_SERVICES);
        setPlans(PLANS);
      });
      const stored = getSelectedTenantId();
      const nextSelected = normalized.some(t => t.id === stored) ? stored : null;
      setSelectedTenantIdState(nextSelected);
      setAdminImpersonation(nextSelected);
      setApiError(null);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Unable to load tenants');
    }
  };

  useEffect(() => {
    void refreshTenants();
  }, [authVersion, user?.id, user?.tenantId, user?.role]);

  const refreshPricing = async () => {
    if (!user || user.role !== 'superadmin') return;
    const catalog = await apiRequest<{ services: Service[]; plans: Plan[] }>('/admin/pricing');
    setServices(catalog.services.map(normalizeService));
    setPlans(catalog.plans.map(normalizePlan));
  };

  const addTenant = (t: Omit<Tenant, 'id' | 'createdAt'>) => {
    const optimistic = { ...t, id: `t${Date.now()}`, createdAt: new Date().toISOString().split('T')[0] };
    setTenants(prev => [...prev, optimistic]);
    void apiRequest<Tenant>('/admin/tenants', { method: 'POST', body: JSON.stringify(t) })
      .then(tenant => {
        const normalized = normalizeTenant(tenant);
        setTenants(prev => [...prev.filter(item => item.id !== optimistic.id), normalized]);
        setApiError(null);
      })
      .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to add tenant'));
  };

  const updateTenant = (id: string, updates: Partial<Tenant>) => {
    setTenants(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    void apiRequest<Tenant>(`/admin/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
      .then(tenant => {
        setTenants(prev => prev.map(item => item.id === id ? normalizeTenant(tenant) : item));
        setApiError(null);
      })
      .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to update tenant'));
  };

  const deleteTenant = (id: string) => {
    setTenants(prev => prev.filter(t => t.id !== id));
    if (selectedTenantId === id) {
      setSelectedTenantIdState(null);
      setAdminImpersonation(null);
    }
    void apiRequest<{ success: boolean }>(`/admin/tenants/${id}`, { method: 'DELETE' })
      .then(() => setApiError(null))
      .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to delete tenant'));
  };

  const addIntegration = (tenantId: string, integration: Omit<TenantIntegration, 'id' | 'addedAt'>) => {
    const optimisticId = `tmp-${Date.now()}`;
    setTenants(prev => prev.map(t => t.id === tenantId
      ? { ...t, integrations: [...t.integrations, { ...integration, id: optimisticId, addedAt: new Date().toISOString().split('T')[0] }] }
      : t
    ));
    void apiRequest<TenantIntegration>(`/admin/tenants/${tenantId}/integrations`, { method: 'POST', body: JSON.stringify(integration) })
      .then(created => {
        setTenants(prev => prev.map(t => t.id === tenantId
          ? { ...t, integrations: t.integrations.map(i => i.id === optimisticId ? normalizeIntegration(created) : i) }
          : t
        ));
        setApiError(null);
      })
      .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to add integration'));
  };

  const updateIntegration = (tenantId: string, integrationId: string, updates: Partial<TenantIntegration>) => {
    setTenants(prev => prev.map(t => t.id === tenantId
      ? { ...t, integrations: t.integrations.map(i => i.id === integrationId ? { ...i, ...updates } : i) }
      : t
    ));
    void apiRequest<TenantIntegration>(`/admin/tenants/${tenantId}/integrations/${integrationId}`, { method: 'PATCH', body: JSON.stringify(updates) })
      .then(updated => {
        setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, integrations: t.integrations.map(i => i.id === integrationId ? normalizeIntegration(updated) : i) } : t));
        setApiError(null);
      })
      .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to update integration'));
  };

  const removeIntegration = (tenantId: string, integrationId: string) => {
    setTenants(prev => prev.map(t => t.id === tenantId
      ? { ...t, integrations: t.integrations.filter(i => i.id !== integrationId) }
      : t
    ));
    void apiRequest<{ success: boolean }>(`/admin/tenants/${tenantId}/integrations/${integrationId}`, { method: 'DELETE' })
      .then(() => setApiError(null))
      .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to remove integration'));
  };

  const updateServicePricing = async (key: ServiceKey, updates: Partial<Service>) => {
    const updated = await apiRequest<Service>(`/admin/pricing/services/${key}`, { method: 'PUT', body: JSON.stringify(updates) });
    setServices(prev => prev.map(service => service.key === key ? normalizeService(updated) : service));
  };

  const updatePlanPricing = async (key: PlanKey, updates: Partial<Plan>) => {
    const catalog = await apiRequest<{ services: Service[]; plans: Plan[] }>(`/admin/pricing/plans/${key}`, { method: 'PATCH', body: JSON.stringify(updates) });
    setServices(catalog.services.map(normalizeService));
    setPlans(catalog.plans.map(normalizePlan));
  };

  const selectedTenant = tenants.find(t => t.id === selectedTenantId) ?? null;

  return (
    <TenantContext.Provider value={{ tenants, services, plans, selectedTenantId, selectedTenant, apiError, selectTenant, startImpersonation, stopImpersonation, refreshTenants, refreshPricing, addTenant, updateTenant, deleteTenant, addIntegration, updateIntegration, removeIntegration, updateServicePricing, updatePlanPricing }}>
      {children}
    </TenantContext.Provider>
  );
}

function normalizeTenant(tenant: Tenant): Tenant {
  return {
    ...tenant,
    mrr: Number(tenant.mrr),
    customPriceEnabled: tenant.customPriceEnabled ?? false,
    customMrr: tenant.customMrr === undefined || tenant.customMrr === null ? undefined : Number(tenant.customMrr),
    discountType: tenant.discountType ?? 'none',
    discountValue: Number(tenant.discountValue ?? 0),
    createdAt: String(tenant.createdAt).split('T')[0],
    trialEndsAt: tenant.trialEndsAt ? String(tenant.trialEndsAt).split('T')[0] : undefined,
    discountExpiresAt: tenant.discountExpiresAt ? String(tenant.discountExpiresAt).split('T')[0] : undefined,
    integrations: tenant.integrations.map(normalizeIntegration),
  };
}

function normalizeIntegration(integration: TenantIntegration): TenantIntegration {
  return {
    ...integration,
    monthlyPrice: Number(integration.monthlyPrice),
    addedAt: String(integration.addedAt).split('T')[0],
  };
}

function normalizeService(service: Service): Service {
  return {
    ...service,
    monthlyPrice: Number(service.monthlyPrice ?? 0),
    isActive: service.isActive ?? true,
  };
}

function normalizePlan(plan: Plan): Plan {
  return {
    ...plan,
    price: Number(plan.price),
    billingCycle: plan.billingCycle === 'annual' ? 'annual' : 'monthly',
    services: plan.services,
    isActive: plan.isActive ?? true,
  };
}

export function useTenants() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenants must be used within TenantProvider');
  return ctx;
}
