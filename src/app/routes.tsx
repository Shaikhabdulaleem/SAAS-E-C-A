import { createBrowserRouter, Navigate } from "react-router";
import type { ReactNode } from "react";
import { MainLayout } from "./layouts/MainLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { ServiceRoute } from "./components/ServiceRoute";
import type { ServiceKey } from "./contexts/TenantContext";
import { Login } from "./pages/Login";
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
import { AIAssistant } from "./pages/AIAssistant";
import { Settings } from "./pages/Settings";
import { Tenants } from "./pages/mcc/Tenants";
import { TenantDetail } from "./pages/mcc/TenantDetail";

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
      { path: "campaigns", element: withService("email_marketing", <Campaigns />) },
      { path: "campaigns/:id", element: withService("email_marketing", <CampaignDetail />) },
      { path: "templates", element: withService("email_marketing", <Templates />) },
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
      { path: "ai-assistant", element: withService("ai_assistant", <AIAssistant />) },
      { path: "settings", Component: Settings },
      {
        path: "mcc/tenants",
        element: <AdminRoute><Tenants /></AdminRoute>,
      },
      {
        path: "mcc/tenants/:id",
        element: <AdminRoute><TenantDetail /></AdminRoute>,
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
