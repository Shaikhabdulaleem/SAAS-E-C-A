import { createBrowserRouter, Navigate } from "react-router";
import type { ReactNode } from "react";
import { MainLayout } from "./layouts/MainLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { ServiceRoute } from "./components/ServiceRoute";
import type { ServiceKey } from "./contexts/TenantContext";
import { Login } from "./pages/Login";
import { InviteAccept } from "./pages/InviteAccept";
import { Dashboard } from "./pages/Dashboard";
import { Contacts } from "./pages/crm/Contacts";
import { ContactDetail } from "./pages/crm/ContactDetail";
import { Companies } from "./pages/crm/Companies";
import { CompanyDetail } from "./pages/crm/CompanyDetail";
import { Deals } from "./pages/crm/Deals";
import { DealDetail } from "./pages/crm/DealDetail";
import { Campaigns } from "./pages/email/Campaigns";
import { CampaignDetail } from "./pages/email/CampaignDetail";
import { Templates } from "./pages/email/Templates";
import { Suppressions } from "./pages/email/Suppressions";
import { EmailAnalytics } from "./pages/email/EmailAnalytics";
import { Automations } from "./pages/email/Automations";
import { AudienceSetup } from "./pages/email/AudienceSetup";
import { DomainSetup } from "./pages/email/DomainSetup";
import { ColdEmailSetup } from "./pages/cold-email/ColdEmailSetup";
import { ColdCampaigns } from "./pages/cold-email/ColdCampaigns";
import { ColdCampaignDetail } from "./pages/cold-email/ColdCampaignDetail";
import { ColdMailboxes } from "./pages/cold-email/Mailboxes";
import { ProspectLists } from "./pages/cold-email/ProspectLists";
import { SendingDomains } from "./pages/cold-email/SendingDomains";
import { ProvisioningWizard } from "./pages/cold-email/ProvisioningWizard";
import { ProviderConnect } from "./pages/cold-email/ProviderConnect";
import { DomainManagement } from "./pages/cold-email/DomainManagement";
import { Personas } from "./pages/cold-email/Personas";
import { DomainHealth } from "./pages/cold-email/DomainHealth";
import { WarmupDashboard } from "./pages/cold-email/WarmupDashboard";
import { EmailFinder } from "./pages/cold-email/EmailFinder";
import { DomainPurchase } from "./pages/cold-email/DomainPurchase";
import { ReplyInbox } from "./pages/cold-email/ReplyInbox";
import { Suppressions as ColdEmailSuppressions } from "./pages/cold-email/Suppressions";
import { DeliverabilityReport } from "./pages/cold-email/DeliverabilityReport";
import { AIAssistant } from "./pages/AIAssistant";
import { ProposalList } from "./pages/proposals/ProposalList";
import { ProposalCreate } from "./pages/proposals/ProposalCreate";
import { ProposalDetail } from "./pages/proposals/ProposalDetail";
import { ProposalAnalytics } from "./pages/proposals/ProposalAnalytics";
import { Finance } from "./pages/Finance";
import { PublicInvoice } from "./pages/finance/PublicInvoice";
import { Settings } from "./pages/Settings";
import { BrandSettings } from "./pages/settings/BrandSettings";
import { ServicePricing } from "./pages/settings/ServicePricing";
import { ProposalTemplates } from "./pages/settings/ProposalTemplates";
import { Tenants } from "./pages/mcc/Tenants";
import { TenantDetail } from "./pages/mcc/TenantDetail";
import { Pricing } from "./pages/mcc/Pricing";
import { RevenueAnalytics } from "./pages/mcc/RevenueAnalytics";
import { AuditLog } from "./pages/mcc/AuditLog";
import { BillingOverview } from "./pages/mcc/BillingOverview";
import { ColdEmailHealth } from "./pages/mcc/ColdEmailHealth";
import { ActivityFeed } from "./pages/mcc/ActivityFeed";
import { AiCostMonitor } from "./pages/mcc/AiCostMonitor";
import { DomainOrders } from "./pages/mcc/DomainOrders";
import { CallAnalytics } from "./pages/mcc/CallAnalytics";
import { OnboardingTemplates } from "./pages/mcc/OnboardingTemplates";
import { MccSettings } from "./pages/mcc/MccSettings";
import { Contracts } from "./pages/mcc/Contracts";
import { FeatureFlags } from "./pages/mcc/FeatureFlags";
import { AlertRules } from "./pages/mcc/AlertRules";
import { TenantBenchmark } from "./pages/mcc/TenantBenchmark";
import { NpsAnalytics } from "./pages/mcc/NpsAnalytics";

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <MainLayout />
    </ProtectedRoute>
  );
}

function withService(service: ServiceKey, children: ReactNode) {
  return <ServiceRoute service={service}>{children}</ServiceRoute>;
}

export const router = createBrowserRouter([
  { path: "/login", Component: Login },
  { path: "/invite/:token", Component: InviteAccept },
  { path: "/invoice/public/:token", Component: PublicInvoice },
  {
    path: "/",
    Component: ProtectedLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "contacts", element: withService("crm", <Contacts />) },
      { path: "contacts/:id", element: withService("crm", <ContactDetail />) },
      { path: "companies", element: withService("crm", <Companies />) },
      { path: "companies/:id", element: withService("crm", <CompanyDetail />) },
      { path: "deals", element: withService("crm", <Deals />) },
      { path: "deals/:id", element: withService("crm", <DealDetail />) },
      { path: "proposals", element: withService("proposals", <ProposalList />) },
      { path: "proposals/create", element: withService("proposals", <ProposalCreate />) },
      { path: "proposals/:id", element: withService("proposals", <ProposalDetail />) },
      { path: "proposals/:id/edit", element: withService("proposals", <ProposalCreate />) },
      { path: "finance", element: withService("finance", <Finance />) },
      { path: "campaigns", element: withService("email_marketing", <Campaigns />) },
      { path: "audience-setup", element: withService("email_marketing", <AudienceSetup />) },
      { path: "domain-setup", element: withService("email_marketing", <DomainSetup />) },
      { path: "campaigns/:id", element: withService("email_marketing", <CampaignDetail />) },
      { path: "templates", element: withService("email_marketing", <Templates />) },
      { path: "suppressions", element: withService("email_marketing", <Suppressions />) },
      { path: "email-analytics", element: withService("email_marketing", <EmailAnalytics />) },
      { path: "automations", element: withService("email_marketing", <Automations />) },
      { path: "cold-email/setup", element: withService("cold_email", <ColdEmailSetup />) },
      { path: "cold-email/campaigns", element: withService("cold_email", <ColdCampaigns />) },
      { path: "cold-email/campaigns/:id", element: withService("cold_email", <ColdCampaignDetail />) },
      { path: "cold-email/mailboxes", element: withService("cold_email", <ColdMailboxes />) },
      { path: "cold-email/prospects", element: withService("cold_email", <ProspectLists />) },
      { path: "cold-email/domains", element: withService("cold_email", <SendingDomains />) },
      { path: "cold-email/provider-connect", element: withService("cold_email", <ProviderConnect />) },
      { path: "cold-email/domain-manager", element: withService("cold_email", <DomainManagement />) },
      { path: "cold-email/provision", element: withService("cold_email", <ProvisioningWizard />) },
      { path: "cold-email/personas", element: withService("cold_email", <Personas />) },
      { path: "cold-email/domain-health", element: withService("cold_email", <DomainHealth />) },
      { path: "cold-email/warmup", element: withService("cold_email", <WarmupDashboard />) },
      { path: "cold-email/email-finder", element: withService("cold_email", <EmailFinder />) },
      { path: "cold-email/domain-purchase", element: withService("cold_email", <DomainPurchase />) },
      { path: "cold-email/replies", element: withService("cold_email", <ReplyInbox />) },
      { path: "cold-email/suppressions", element: withService("cold_email", <ColdEmailSuppressions />) },
      { path: "cold-email/deliverability", element: withService("cold_email", <DeliverabilityReport />) },
      { path: "ai-assistant", element: withService("ai_assistant", <AIAssistant />) },
      { path: "settings", Component: Settings },
      { path: "settings/brand", element: withService("proposals", <BrandSettings />) },
      { path: "settings/service-pricing", element: withService("proposals", <ServicePricing />) },
      { path: "settings/proposal-templates", element: withService("proposals", <ProposalTemplates />) },
      {
        path: "mcc/tenants",
        element: <AdminRoute><Tenants /></AdminRoute>,
      },
      {
        path: "mcc/tenants/:id",
        element: <AdminRoute><TenantDetail /></AdminRoute>,
      },
      {
        path: "mcc/pricing",
        element: <AdminRoute><Pricing /></AdminRoute>,
      },
      {
        path: "mcc/revenue",
        element: <AdminRoute><RevenueAnalytics /></AdminRoute>,
      },
      {
        path: "mcc/proposals",
        element: <AdminRoute><ProposalList admin /></AdminRoute>,
      },
      {
        path: "mcc/proposals/analytics",
        element: <AdminRoute><ProposalAnalytics /></AdminRoute>,
      },
      {
        path: "mcc/proposals/create",
        element: <AdminRoute><ProposalCreate admin /></AdminRoute>,
      },
      {
        path: "mcc/proposals/:id",
        element: <AdminRoute><ProposalDetail admin /></AdminRoute>,
      },
      {
        path: "mcc/proposals/:id/edit",
        element: <AdminRoute><ProposalCreate admin /></AdminRoute>,
      },
      {
        path: "mcc/audit-log",
        element: <AdminRoute><AuditLog /></AdminRoute>,
      },
      {
        path: "mcc/finance",
        element: <AdminRoute><Finance admin /></AdminRoute>,
      },
      {
        path: "mcc/billing",
        element: <AdminRoute><BillingOverview /></AdminRoute>,
      },
      {
        path: "mcc/cold-email-health",
        element: <AdminRoute><ColdEmailHealth /></AdminRoute>,
      },
      {
        path: "mcc/activity-feed",
        element: <AdminRoute><ActivityFeed /></AdminRoute>,
      },
      {
        path: "mcc/ai-usage",
        element: <AdminRoute><AiCostMonitor /></AdminRoute>,
      },
      {
        path: "mcc/domain-orders",
        element: <AdminRoute><DomainOrders /></AdminRoute>,
      },
      {
        path: "mcc/call-analytics",
        element: <AdminRoute><CallAnalytics /></AdminRoute>,
      },
      {
        path: "mcc/onboarding-templates",
        element: <AdminRoute><OnboardingTemplates /></AdminRoute>,
      },
      {
        path: "mcc/settings",
        element: <AdminRoute><MccSettings /></AdminRoute>,
      },
      {
        path: "mcc/contracts",
        element: <AdminRoute><Contracts /></AdminRoute>,
      },
      {
        path: "mcc/feature-flags",
        element: <AdminRoute><FeatureFlags /></AdminRoute>,
      },
      {
        path: "mcc/alerts",
        element: <AdminRoute><AlertRules /></AdminRoute>,
      },
      {
        path: "mcc/benchmarks",
        element: <AdminRoute><TenantBenchmark /></AdminRoute>,
      },
      {
        path: "mcc/nps",
        element: <AdminRoute><NpsAnalytics /></AdminRoute>,
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
