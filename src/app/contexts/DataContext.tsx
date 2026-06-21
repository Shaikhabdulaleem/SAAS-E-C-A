import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiRequest, getAccessToken } from '../lib/api';
import { useAuth } from './AuthContext';
import { useTenants } from './TenantContext';
import type { ServiceKey } from './TenantContext';

// Types
export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  companyId?: string;
  assignedTo?: string;
  status: 'lead' | 'prospect' | 'customer' | 'churned';
  source: 'manual' | 'import' | 'campaign' | 'api';
  tags: string[];
  marketingConsent: boolean;
  marketingConsentSource?: string;
  marketingConsentCapturedAt?: string;
  createdAt: string;
  lastActivityAt: string;
}

export interface Company {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: '1-10' | '11-50' | '51-200' | '201-1000' | '1000+';
  website?: string;
  phone?: string;
  assignedTo?: string;
  tags: string[];
  createdAt: string;
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  currency: string;
  stage: string;
  companyId?: string;
  assignedTo: string;
  status: 'open' | 'won' | 'lost';
  probability: number;
  expectedCloseDate?: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  previewText?: string;
  fromName: string;
  fromEmail: string;
  replyToEmail?: string;
  body?: string;
  bodyPlainText?: string;
  contentBlocks?: EmailContentBlock[];
  abTestEnabled?: boolean;
  abVariants?: EmailAbVariant[];
  selectedVariant?: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'partial_failed' | 'cancelled';
  scheduledAt?: string;
  scheduledTz?: string;
  sentAt?: string;
  completedAt?: string;
  lastError?: string;
  recipientFilter?: {
    mode?: 'all' | 'manual';
    contactIds?: string[];
    statuses?: string[];
    tags?: string[];
    companyId?: string;
  };
  totalRecipients: number;
  openCount: number;
  clickCount: number;
  bounceCount: number;
  unsubCount: number;
  dailySendLimit?: number;
  throttlePerHour?: number;
  trackOpens: boolean;
  trackClicks: boolean;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  gdprConsent: boolean;
  doubleOptIn: boolean;
  companyAddress?: string;
  createdAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  contentBlocks?: EmailContentBlock[];
  category?: string;
  createdAt: string;
}

export interface EmailContentBlock {
  id: string;
  type: 'text' | 'image' | 'button' | 'offer' | 'divider' | 'footer';
  props: Record<string, string>;
}

export interface EmailAbVariant {
  id: string;
  label: string;
  subject: string;
  previewText?: string;
  body: string;
  contentBlocks?: EmailContentBlock[];
}

export interface Activity {
  id: string;
  type: string;
  subject: string;
  body?: string;
  contactId?: string;
  companyId?: string;
  dealId?: string;
  createdBy: string;
  createdAt: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface DataContextType {
  contacts: Contact[];
  companies: Company[];
  deals: Deal[];
  campaigns: Campaign[];
  templates: EmailTemplate[];
  activities: Activity[];
  aiMessages: AIMessage[];
  apiError: string | null;
  refreshData: () => Promise<void>;
  addContact: (contact: Omit<Contact, 'id' | 'createdAt' | 'lastActivityAt'>) => void;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  deleteContact: (id: string) => void;
  addCompany: (company: Omit<Company, 'id' | 'createdAt'>) => void;
  updateCompany: (id: string, updates: Partial<Company>) => void;
  deleteCompany: (id: string) => void;
  addDeal: (deal: Omit<Deal, 'id' | 'createdAt'>) => void;
  updateDeal: (id: string, updates: Partial<Deal>) => void;
  deleteDeal: (id: string) => void;
  addCampaign: (campaign: Omit<Campaign, 'id' | 'createdAt'>) => void;
  updateCampaign: (id: string, updates: Partial<Campaign>) => void;
  deleteCampaign: (id: string) => void;
  sendCampaignNow: (id: string) => void;
  addTemplate: (template: Omit<EmailTemplate, 'id' | 'createdAt'>) => void;
  updateTemplate: (id: string, updates: Partial<EmailTemplate>) => void;
  deleteTemplate: (id: string) => void;
  addActivity: (activity: Omit<Activity, 'id' | 'createdAt'>) => void;
  addAIMessage: (message: Omit<AIMessage, 'id' | 'timestamp'>) => void;
  clearAIMessages: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, authVersion } = useAuth();
  const { selectedTenantId, selectedTenant } = useTenants();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  const refreshData = async () => {
    if (!user || !getAccessToken()) {
      setContacts([]);
      setCompanies([]);
      setDeals([]);
      setCampaigns([]);
      setTemplates([]);
      setActivities([]);
      setApiError(null);
      return;
    }
    if (user.role === 'superadmin' && !selectedTenantId) {
      setContacts([]);
      setCompanies([]);
      setDeals([]);
      setCampaigns([]);
      setTemplates([]);
      setActivities([]);
      setApiError('Select a client tenant to load tenant data.');
      return;
    }

    try {
      const hasService = (service: ServiceKey) => (
        user.role === 'superadmin'
          ? (selectedTenant?.enabledServices ?? []).includes(service)
          : (user.enabledServices ?? []).includes(service)
      );

      let nextContacts: Contact[] = [];
      let nextCompanies: Company[] = [];
      let nextDeals: Deal[] = [];
      let nextActivities: Activity[] = [];
      let nextCampaigns: Campaign[] = [];
      let nextTemplates: EmailTemplate[] = [];

      if (hasService('crm') || hasService('email_marketing')) {
        nextContacts = await apiRequest<Contact[]>('/contacts');
      }

      if (hasService('crm')) {
        [nextCompanies, nextDeals, nextActivities] = await Promise.all([
          apiRequest<Company[]>('/companies'),
          apiRequest<Deal[]>('/deals'),
          apiRequest<Activity[]>('/activities'),
        ]);
      }

      if (hasService('email_marketing')) {
        [nextCampaigns, nextTemplates] = await Promise.all([
          apiRequest<Campaign[]>('/email/campaigns'),
          apiRequest<EmailTemplate[]>('/email/templates'),
        ]);
      }

      setContacts(nextContacts.map(normalizeContact));
      setCompanies(nextCompanies.map(normalizeCompany));
      setDeals(nextDeals.map(normalizeDeal));
      setCampaigns(nextCampaigns.map(normalizeCampaign));
      setTemplates(nextTemplates.map(normalizeTemplate));
      setActivities(nextActivities);
      setApiError(null);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Unable to load CRM data');
    }
  };

  useEffect(() => {
    void refreshData();
  }, [authVersion, user?.id, user?.role, selectedTenantId, selectedTenant?.id]);

  const addContact = (contact: Omit<Contact, 'id' | 'createdAt' | 'lastActivityAt'>) => {
    const newContact: Contact = {
      ...contact,
      id: Date.now().toString(),
      createdAt: new Date().toISOString().split('T')[0],
      lastActivityAt: new Date().toISOString().split('T')[0],
    };
    setContacts([...contacts, newContact]);
    if (getAccessToken()) void apiRequest<Contact>('/contacts', { method: 'POST', body: JSON.stringify(contact) })
      .then(c => { setContacts(prev => [...prev.filter(item => item.id !== newContact.id), normalizeContact(c)]); setApiError(null); })
      .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to add contact'));
  };

  const updateContact = (id: string, updates: Partial<Contact>) => {
    setContacts(contacts.map(c => c.id === id ? { ...c, ...updates } : c));
    if (getAccessToken()) void apiRequest<Contact>(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
      .then(c => { setContacts(prev => prev.map(item => item.id === id ? normalizeContact(c) : item)); setApiError(null); })
      .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to update contact'));
  };

  const deleteContact = (id: string) => {
    setContacts(contacts.filter(c => c.id !== id));
    if (getAccessToken()) void apiRequest<{ success: boolean }>(`/contacts/${id}`, { method: 'DELETE' })
      .then(() => setApiError(null))
      .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to delete contact'));
  };

  const addCompany = (company: Omit<Company, 'id' | 'createdAt'>) => {
    const newCompany: Company = {
      ...company,
      id: Date.now().toString(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    setCompanies([...companies, newCompany]);
    if (getAccessToken()) void apiRequest<Company>('/companies', { method: 'POST', body: JSON.stringify(company) })
      .then(c => { setCompanies(prev => [...prev.filter(item => item.id !== newCompany.id), normalizeCompany(c)]); setApiError(null); })
      .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to add company'));
  };

  const updateCompany = (id: string, updates: Partial<Company>) => {
    setCompanies(companies.map(c => c.id === id ? { ...c, ...updates } : c));
    if (getAccessToken()) void apiRequest<Company>(`/companies/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
      .then(c => { setCompanies(prev => prev.map(item => item.id === id ? normalizeCompany(c) : item)); setApiError(null); })
      .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to update company'));
  };

  const deleteCompany = (id: string) => {
    setCompanies(companies.filter(c => c.id !== id));
    if (getAccessToken()) void apiRequest<{ success: boolean }>(`/companies/${id}`, { method: 'DELETE' })
      .then(() => setApiError(null))
      .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to delete company'));
  };

  const addDeal = (deal: Omit<Deal, 'id' | 'createdAt'>) => {
    const newDeal: Deal = {
      ...deal,
      id: Date.now().toString(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    setDeals([...deals, newDeal]);
    if (getAccessToken()) void apiRequest<Deal>('/deals', { method: 'POST', body: JSON.stringify(deal) })
      .then(d => { setDeals(prev => [...prev.filter(item => item.id !== newDeal.id), normalizeDeal(d)]); setApiError(null); })
      .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to add deal'));
  };

  const updateDeal = (id: string, updates: Partial<Deal>) => {
    setDeals(deals.map(d => d.id === id ? { ...d, ...updates } : d));
    if (getAccessToken()) void apiRequest<Deal>(`/deals/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
      .then(d => { setDeals(prev => prev.map(item => item.id === id ? normalizeDeal(d) : item)); setApiError(null); })
      .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to update deal'));
  };

  const deleteDeal = (id: string) => {
    setDeals(deals.filter(d => d.id !== id));
    if (getAccessToken()) void apiRequest<{ success: boolean }>(`/deals/${id}`, { method: 'DELETE' })
      .then(() => setApiError(null))
      .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to delete deal'));
  };

  const addCampaign = (campaign: Omit<Campaign, 'id' | 'createdAt'>) => {
    if (getAccessToken()) void apiRequest<Campaign>('/email/campaigns', { method: 'POST', body: JSON.stringify({ ...campaign, status: 'draft' }) })
      .then(c => {
        if (campaign.status === 'scheduled' && campaign.scheduledAt) {
          return apiRequest<Campaign>(`/email/campaigns/${c.id}/schedule`, {
            method: 'POST',
            body: JSON.stringify({ scheduledAt: campaign.scheduledAt }),
          });
        }
        return c;
      })
      .then(c => { setCampaigns(prev => [normalizeCampaign(c), ...prev]); setApiError(null); })
      .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to add campaign'));
  };

  const updateCampaign = (id: string, updates: Partial<Campaign>) => {
    if (getAccessToken()) void apiRequest<Campaign>(`/email/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
      .then(c => { setCampaigns(prev => prev.map(item => item.id === id ? normalizeCampaign(c) : item)); setApiError(null); })
      .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to update campaign'));
  };

  const deleteCampaign = (id: string) => {
    if (getAccessToken()) void apiRequest<{ success: boolean }>(`/email/campaigns/${id}`, { method: 'DELETE' })
      .then(() => { setCampaigns(prev => prev.filter(c => c.id !== id)); setApiError(null); })
      .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to delete campaign'));
  };

  const sendCampaignNow = (id: string) => {
    if (getAccessToken()) void apiRequest<Campaign>(`/email/campaigns/${id}/send-now`, { method: 'POST' })
      .then(c => { setCampaigns(prev => prev.map(item => item.id === id ? normalizeCampaign(c) : item)); setApiError(null); })
      .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to send campaign'));
  };

  const addTemplate = (template: Omit<EmailTemplate, 'id' | 'createdAt'>) => {
    if (getAccessToken()) void apiRequest<EmailTemplate>('/email/templates', { method: 'POST', body: JSON.stringify(template) })
      .then(t => { setTemplates(prev => [normalizeTemplate(t), ...prev]); setApiError(null); })
      .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to add template'));
  };

  const updateTemplate = (id: string, updates: Partial<EmailTemplate>) => {
    if (getAccessToken()) void apiRequest<EmailTemplate>(`/email/templates/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
      .then(t => { setTemplates(prev => prev.map(item => item.id === id ? normalizeTemplate(t) : item)); setApiError(null); })
      .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to update template'));
  };

  const deleteTemplate = (id: string) => {
    if (getAccessToken()) void apiRequest<{ success: boolean }>(`/email/templates/${id}`, { method: 'DELETE' })
      .then(() => { setTemplates(prev => prev.filter(t => t.id !== id)); setApiError(null); })
      .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to delete template'));
  };

  const addActivity = (activity: Omit<Activity, 'id' | 'createdAt'>) => {
    const newActivity: Activity = {
      ...activity,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    setActivities([newActivity, ...activities]);
    if (getAccessToken()) void apiRequest<Activity>('/activities', { method: 'POST', body: JSON.stringify(activity) })
      .then(a => { setActivities(prev => [a, ...prev.filter(item => item.id !== newActivity.id)]); setApiError(null); })
      .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to add activity'));
  };

  const addAIMessage = (message: Omit<AIMessage, 'id' | 'timestamp'>) => {
    const newMessage: AIMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
    };
    setAiMessages([...aiMessages, newMessage]);
    if (getAccessToken() && message.role === 'user') {
      void apiRequest<{ message: AIMessage }>('/ai/chat', { method: 'POST', body: JSON.stringify({ message: message.content }) })
        .then(result => setAiMessages(prev => [...prev, { ...result.message, id: Date.now().toString(), timestamp: result.message.timestamp ?? new Date().toISOString() }]))
        .catch(error => setApiError(error instanceof Error ? error.message : 'Unable to get AI response'));
    }
  };

  const clearAIMessages = () => {
    setAiMessages([]);
  };

  return (
    <DataContext.Provider
      value={{
        contacts,
        companies,
        deals,
        campaigns,
        templates,
        activities,
        aiMessages,
        apiError,
        refreshData,
        addContact,
        updateContact,
        deleteContact,
        addCompany,
        updateCompany,
        deleteCompany,
        addDeal,
        updateDeal,
        deleteDeal,
        addCampaign,
        updateCampaign,
        deleteCampaign,
        sendCampaignNow,
        addTemplate,
        updateTemplate,
        deleteTemplate,
        addActivity,
        addAIMessage,
        clearAIMessages,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

function normalizeContact(contact: Contact): Contact {
  return {
    ...contact,
    marketingConsent: contact.marketingConsent ?? false,
    createdAt: String(contact.createdAt).split('T')[0],
    lastActivityAt: String(contact.lastActivityAt).split('T')[0],
  };
}

function normalizeCompany(company: Company): Company {
  return { ...company, createdAt: String(company.createdAt).split('T')[0] };
}

function normalizeDeal(deal: Deal): Deal {
  return { ...deal, value: Number(deal.value), createdAt: String(deal.createdAt).split('T')[0], expectedCloseDate: deal.expectedCloseDate ? String(deal.expectedCloseDate).split('T')[0] : undefined };
}

function normalizeCampaign(campaign: Campaign): Campaign {
  return {
    ...campaign,
    totalRecipients: Number(campaign.totalRecipients),
    openCount: Number(campaign.openCount),
    clickCount: Number(campaign.clickCount),
    bounceCount: Number(campaign.bounceCount ?? 0),
    unsubCount: Number(campaign.unsubCount ?? 0),
    trackOpens: campaign.trackOpens ?? true,
    trackClicks: campaign.trackClicks ?? true,
    gdprConsent: campaign.gdprConsent ?? false,
    doubleOptIn: campaign.doubleOptIn ?? false,
    abTestEnabled: campaign.abTestEnabled ?? false,
    createdAt: String(campaign.createdAt).split('T')[0],
    scheduledAt: campaign.scheduledAt ? String(campaign.scheduledAt) : undefined,
    sentAt: campaign.sentAt ? String(campaign.sentAt) : undefined,
    completedAt: campaign.completedAt ? String(campaign.completedAt) : undefined,
  };
}

function normalizeTemplate(template: EmailTemplate): EmailTemplate {
  return {
    ...template,
    createdAt: String(template.createdAt).split('T')[0],
  };
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
