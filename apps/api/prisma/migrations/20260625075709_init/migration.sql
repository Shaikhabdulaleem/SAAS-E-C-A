-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('superadmin', 'client');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('onboarding', 'active', 'trial', 'payment_failed', 'suspended', 'cancelled');

-- CreateEnum
CREATE TYPE "PlanKey" AS ENUM ('starter', 'growth', 'business', 'enterprise');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('lead', 'prospect', 'customer', 'churned');

-- CreateEnum
CREATE TYPE "ContactSource" AS ENUM ('manual', 'import', 'campaign', 'api');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('open', 'won', 'lost');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'scheduled', 'sending', 'paused', 'sent', 'partial_failed', 'cancelled');

-- CreateEnum
CREATE TYPE "EmailEventType" AS ENUM ('delivered', 'open', 'click', 'bounce', 'soft_bounce', 'complaint', 'unsubscribe');

-- CreateEnum
CREATE TYPE "MailboxProvider" AS ENUM ('gmail', 'outlook', 'custom_smtp');

-- CreateEnum
CREATE TYPE "WarmupStatus" AS ENUM ('not_started', 'warming', 'ready', 'paused');

-- CreateEnum
CREATE TYPE "MailboxStatus" AS ENUM ('active', 'paused', 'error', 'disconnected');

-- CreateEnum
CREATE TYPE "ProspectValidation" AS ENUM ('valid', 'risky', 'invalid', 'pending');

-- CreateEnum
CREATE TYPE "ColdCampaignStatus" AS ENUM ('draft', 'active', 'paused', 'completed', 'error');

-- CreateEnum
CREATE TYPE "ColdProspectStatus" AS ENUM ('queued', 'processing', 'active', 'replied', 'interested', 'not_interested', 'unsubscribed', 'bounced', 'completed');

-- CreateEnum
CREATE TYPE "DnsRecordStatus" AS ENUM ('verified', 'not_set', 'error');

-- CreateEnum
CREATE TYPE "TenantMemberRole" AS ENUM ('owner', 'admin', 'sales', 'marketer', 'viewer');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('pending', 'accepted', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "ProviderLogStatus" AS ENUM ('success', 'failed', 'pending');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('campaign_completed', 'reply_received', 'failed_send', 'domain_unhealthy', 'dns_failure', 'mailbox_warmup_paused', 'payment_failure', 'invite_accepted', 'provider_sync_failure', 'system');

-- CreateEnum
CREATE TYPE "SuppressionSource" AS ENUM ('manual', 'unsubscribe', 'bounce', 'complaint', 'import');

-- CreateEnum
CREATE TYPE "EmailLinkPurpose" AS ENUM ('unsubscribe', 'preferences', 'view', 'opt_in');

-- CreateEnum
CREATE TYPE "BillingSubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid');

-- CreateEnum
CREATE TYPE "ProvisioningStatus" AS ENUM ('pending', 'succeeded', 'failed', 'rolled_back');

-- CreateEnum
CREATE TYPE "CallSessionStatus" AS ENUM ('uploaded', 'transcribing', 'transcribed', 'summarized', 'failed');

-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('draft', 'active', 'paused', 'completed');

-- CreateEnum
CREATE TYPE "AutomationTriggerType" AS ENUM ('contact_added', 'tag_added', 'form_submitted', 'date_based', 'manual');

-- CreateEnum
CREATE TYPE "AutomationStepType" AS ENUM ('send_email', 'wait_delay', 'wait_until', 'condition', 'add_tag', 'remove_tag', 'update_contact');

-- CreateEnum
CREATE TYPE "EmailFormat" AS ENUM ('firstname_at', 'firstname_dot_lastname', 'firstnamelastname', 'f_dot_lastname');

-- CreateEnum
CREATE TYPE "EmailProviderType" AS ENUM ('google_workspace', 'microsoft_365');

-- CreateEnum
CREATE TYPE "DnsProviderType" AS ENUM ('cloudflare', 'namecheap');

-- CreateEnum
CREATE TYPE "DomainPurchaseStatus" AS ENUM ('generating', 'checking', 'awaiting_confirmation', 'purchasing', 'setting_nameservers', 'configuring_dns', 'creating_mailboxes', 'warming_up', 'completed', 'failed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "initials" TEXT NOT NULL,
    "tenantId" TEXT,
    "tenantName" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecretCipher" TEXT,
    "backupCodes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "industry" TEXT,
    "plan" "PlanKey" NOT NULL,
    "status" "TenantStatus" NOT NULL,
    "seats" INTEGER NOT NULL,
    "mrr" DECIMAL(10,2) NOT NULL,
    "customPriceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "customMrr" DECIMAL(10,2),
    "discountType" TEXT NOT NULL DEFAULT 'none',
    "discountValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "discountExpiresAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantUser" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TenantMemberRole" NOT NULL DEFAULT 'viewer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantService" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCatalog" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "monthlyPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCatalog_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PlanCatalog" (
    "key" "PlanKey" NOT NULL,
    "label" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "color" TEXT NOT NULL,
    "bgColor" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanCatalog_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PlanCatalogService" (
    "id" TEXT NOT NULL,
    "planKey" "PlanKey" NOT NULL,
    "serviceKey" TEXT NOT NULL,

    CONSTRAINT "PlanCatalogService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantIntegration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "platformKey" TEXT NOT NULL,
    "customName" TEXT,
    "apiKeyCipher" TEXT NOT NULL,
    "monthlyPrice" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "tenantId" TEXT,
    "event" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "jobTitle" TEXT,
    "companyId" TEXT,
    "assignedTo" TEXT,
    "status" "ContactStatus" NOT NULL DEFAULT 'lead',
    "source" "ContactSource" NOT NULL DEFAULT 'manual',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "marketingConsentSource" TEXT,
    "marketingConsentCapturedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEmailSentAt" TIMESTAMP(3),
    "emailSendCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "industry" TEXT,
    "size" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "assignedTo" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "stage" TEXT NOT NULL,
    "companyId" TEXT,
    "assignedTo" TEXT NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'open',
    "probability" INTEGER NOT NULL,
    "expectedCloseDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "contactId" TEXT,
    "companyId" TEXT,
    "dealId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "contentBlocks" JSONB,
    "category" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "previewText" TEXT,
    "fromName" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "replyToEmail" TEXT,
    "body" TEXT,
    "bodyPlainText" TEXT,
    "contentBlocks" JSONB,
    "abTestEnabled" BOOLEAN NOT NULL DEFAULT false,
    "abVariants" JSONB,
    "selectedVariant" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "scheduledTz" TEXT,
    "sentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "sendContinuationAt" TIMESTAMP(3),
    "lastError" TEXT,
    "sendJobId" TEXT,
    "recipientFilter" JSONB,
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "bounceCount" INTEGER NOT NULL DEFAULT 0,
    "unsubCount" INTEGER NOT NULL DEFAULT 0,
    "dailySendLimit" INTEGER,
    "throttlePerHour" INTEGER,
    "trackOpens" BOOLEAN NOT NULL DEFAULT true,
    "trackClicks" BOOLEAN NOT NULL DEFAULT true,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "gdprConsent" BOOLEAN NOT NULL DEFAULT false,
    "doubleOptIn" BOOLEAN NOT NULL DEFAULT false,
    "companyAddress" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "ipPool" TEXT,
    "automationId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "providerRequestId" TEXT,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "variantId" TEXT,
    "lastError" TEXT,

    CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "recipientId" TEXT,
    "type" "EmailEventType" NOT NULL,
    "url" TEXT,
    "providerId" TEXT,
    "eventKey" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailAutomation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger" "AutomationTriggerType" NOT NULL DEFAULT 'manual',
    "triggerConfig" JSONB,
    "status" "AutomationStatus" NOT NULL DEFAULT 'draft',
    "enrolledCount" INTEGER NOT NULL DEFAULT 0,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationStep" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "type" "AutomationStepType" NOT NULL,
    "name" TEXT,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationExecution" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "currentStepId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSegment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filterRules" JSONB NOT NULL,
    "contactCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "plan" "PlanKey" NOT NULL,
    "status" "BillingSubscriptionStatus" NOT NULL DEFAULT 'incomplete',
    "seats" INTEGER NOT NULL DEFAULT 1,
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT,
    "number" TEXT,
    "status" TEXT NOT NULL,
    "amountDue" DECIMAL(10,2) NOT NULL,
    "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "hostedUrl" TEXT,
    "pdfUrl" TEXT,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethodRef" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stripePaymentMethodId" TEXT,
    "brand" TEXT,
    "last4" TEXT,
    "expMonth" INTEGER,
    "expYear" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethodRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,6),
    "period" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'client',
    "proposalNumber" TEXT,
    "createdByType" TEXT NOT NULL DEFAULT 'client',
    "recipientType" TEXT NOT NULL DEFAULT 'customer',
    "title" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "companyName" TEXT,
    "contactId" TEXT,
    "companyId" TEXT,
    "dealId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "contractDuration" TEXT,
    "paymentTerms" TEXT,
    "setupFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountType" TEXT NOT NULL DEFAULT 'none',
    "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "mccCostAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "creatorProfitAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "validUntil" TIMESTAMP(3),
    "customIntroMessage" TEXT,
    "templateId" TEXT NOT NULL DEFAULT 'modern',
    "brandingSnapshot" JSONB,
    "trackingToken" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "signatureData" JSONB,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalLineItem" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "ProposalLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalService" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "listPrice" DECIMAL(12,2) NOT NULL,
    "discountPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "finalPrice" DECIMAL(12,2) NOT NULL,
    "mccBaseCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "creatorMargin" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "features" JSONB NOT NULL DEFAULT '[]',
    "customDescription" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalSection" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "sectionTitle" TEXT NOT NULL,
    "content" JSONB,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalActivity" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'client',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "style" TEXT NOT NULL DEFAULT 'modern',
    "aboutUsContent" TEXT,
    "termsItems" JSONB NOT NULL DEFAULT '[]',
    "timelineSteps" JSONB NOT NULL DEFAULT '[]',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientBrandSetting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyName" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#1a56db',
    "accentColor" TEXT NOT NULL DEFAULT '#7c3aed',
    "fontFamily" TEXT NOT NULL DEFAULT 'Inter',
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "websiteUrl" TEXT,
    "address" TEXT,
    "aboutUsText" TEXT,
    "proposalPrefix" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientBrandSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientServicePricing" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "mccCost" DECIMAL(12,2) NOT NULL,
    "sellingPrice" DECIMAL(12,2) NOT NULL,
    "marginAmount" DECIMAL(12,2) NOT NULL,
    "marginPercentage" DECIMAL(5,2) NOT NULL,
    "planFeatures" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientServicePricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'client',
    "number" TEXT NOT NULL,
    "invoiceType" TEXT NOT NULL DEFAULT 'one_time',
    "createdByType" TEXT NOT NULL DEFAULT 'client',
    "recipientType" TEXT NOT NULL DEFAULT 'customer',
    "recipientId" TEXT,
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "recipientCompany" TEXT,
    "contactId" TEXT,
    "companyId" TEXT,
    "proposalId" TEXT,
    "subscriptionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "billingPeriodStart" TIMESTAMP(3),
    "billingPeriodEnd" TIMESTAMP(3),
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountType" TEXT NOT NULL DEFAULT 'none',
    "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balanceDue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentTerms" TEXT,
    "notes" TEXT,
    "paymentInstructions" TEXT,
    "templateId" TEXT NOT NULL DEFAULT 'modern',
    "internalNotes" TEXT,
    "brandingSnapshot" JSONB,
    "pdfUrl" TEXT,
    "pdfGeneratedAt" TIMESTAMP(3),
    "publicToken" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "overdueReminderSentAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceInvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL DEFAULT 'custom',
    "planName" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "billingPeriod" TEXT,
    "features" JSONB NOT NULL DEFAULT '[]',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "mccCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "creatorMargin" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceInvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'client',
    "invoiceId" TEXT,
    "reference" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "method" TEXT,
    "gateway" TEXT,
    "gatewayTransactionId" TEXT,
    "payerType" TEXT NOT NULL DEFAULT 'customer',
    "payerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "recordedBy" TEXT,
    "failureReason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCost" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'client',
    "vendor" TEXT NOT NULL,
    "category" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "incurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'client',
    "createdByType" TEXT NOT NULL DEFAULT 'client',
    "subscriberType" TEXT NOT NULL DEFAULT 'customer',
    "subscriberId" TEXT,
    "subscriberName" TEXT NOT NULL,
    "subscriberEmail" TEXT,
    "proposalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "cycleAnchorDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "nextBillingDate" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "monthlyAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cycleAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "autoInvoice" BOOLEAN NOT NULL DEFAULT true,
    "cancellationReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "pauseReason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceSubscriptionService" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "mccCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceSubscriptionService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceRefund" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'client',
    "invoiceId" TEXT NOT NULL,
    "paymentId" TEXT,
    "creditNoteNumber" TEXT NOT NULL,
    "refundType" TEXT NOT NULL DEFAULT 'partial',
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'other',
    "reasonNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "creditNotePdfUrl" TEXT,
    "processedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "notifyRecipient" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceTaxConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'mcc',
    "name" TEXT NOT NULL,
    "rate" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'percentage',
    "appliesTo" TEXT NOT NULL DEFAULT 'all',
    "applicableServices" JSONB,
    "region" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceTaxConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceSetting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'mcc',
    "invoicePrefix" TEXT NOT NULL DEFAULT 'MCC-INV',
    "creditNotePrefix" TEXT NOT NULL DEFAULT 'MCC-CN',
    "defaultPaymentTerms" TEXT NOT NULL DEFAULT 'Net 15',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "defaultTaxConfigId" TEXT,
    "bankDetails" JSONB,
    "acceptedPaymentMethods" JSONB NOT NULL DEFAULT '[]',
    "paymentGatewayConfigCipher" TEXT,
    "invoiceFooterText" TEXT,
    "invoiceNotesTemplate" TEXT,
    "latePaymentFeePercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "autoSendInvoices" BOOLEAN NOT NULL DEFAULT false,
    "autoGenerateFromSubscription" BOOLEAN NOT NULL DEFAULT true,
    "reminderDays" JSONB NOT NULL DEFAULT '[3,7,14]',
    "overdueAction" TEXT NOT NULL DEFAULT 'remind_only',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceInvoiceActivity" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceInvoiceActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceSequence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'mcc',
    "sequenceType" TEXT NOT NULL DEFAULT 'invoice',
    "year" INTEGER NOT NULL,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantInvite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "TenantMemberRole" NOT NULL DEFAULT 'viewer',
    "tokenHash" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'pending',
    "invitedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "queue" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "payload" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "providerRequestId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" "ProviderLogStatus" NOT NULL DEFAULT 'pending',
    "requestId" TEXT,
    "request" JSONB,
    "response" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuppressionEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" "SuppressionSource" NOT NULL DEFAULT 'manual',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuppressionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnsubscribeToken" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" "EmailLinkPurpose" NOT NULL DEFAULT 'unsubscribe',
    "campaignId" TEXT,
    "coldCampaignId" TEXT,
    "recipientId" TEXT,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnsubscribeToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPreference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subscribed" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledReport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'weekly',
    "recipients" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "nextSendAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT,
    "campaignId" TEXT,
    "coldCampaignId" TEXT,
    "recipientId" TEXT,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "token" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "action" TEXT NOT NULL,
    "model" TEXT,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SendingDomain" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "spfStatus" "DnsRecordStatus" NOT NULL DEFAULT 'not_set',
    "dkimStatus" "DnsRecordStatus" NOT NULL DEFAULT 'not_set',
    "dmarcStatus" "DnsRecordStatus" NOT NULL DEFAULT 'not_set',
    "mxStatus" "DnsRecordStatus" NOT NULL DEFAULT 'not_set',
    "dkimSelector" TEXT,
    "dkimType" TEXT,
    "dkimHost" TEXT,
    "dkimValue" TEXT,
    "trackingDomain" TEXT,
    "trackingCnameValue" TEXT,
    "trackingDomainActive" BOOLEAN NOT NULL DEFAULT false,
    "healthScore" INTEGER NOT NULL DEFAULT 0,
    "blacklistStatus" TEXT NOT NULL DEFAULT 'clean',
    "blacklistCheckedAt" TIMESTAMP(3),
    "purchasedAt" TIMESTAMP(3),
    "currentDailyCap" INTEGER NOT NULL DEFAULT 50,
    "sentToday" INTEGER NOT NULL DEFAULT 0,
    "lastRestedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "targetDailyVolume" INTEGER,
    "requiredMailboxes" INTEGER,
    "dnsProvider" "DnsProviderType",
    "dnsApiKeyCipher" TEXT,
    "dnsZoneId" TEXT,
    "providerCredentialId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SendingDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColdMailbox" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "MailboxProvider" NOT NULL,
    "email" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "replyToEmail" TEXT,
    "status" "MailboxStatus" NOT NULL DEFAULT 'active',
    "dailySendLimit" INTEGER NOT NULL DEFAULT 40,
    "sendWindowStart" TEXT NOT NULL DEFAULT '08:00',
    "sendWindowEnd" TEXT NOT NULL DEFAULT '17:00',
    "sendWeekdaysOnly" BOOLEAN NOT NULL DEFAULT true,
    "minDelaySeconds" INTEGER NOT NULL DEFAULT 180,
    "maxDelaySeconds" INTEGER NOT NULL DEFAULT 480,
    "warmupEnabled" BOOLEAN NOT NULL DEFAULT false,
    "warmupStatus" "WarmupStatus" NOT NULL DEFAULT 'not_started',
    "warmupDailyTarget" INTEGER NOT NULL DEFAULT 5,
    "warmupStartedAt" TIMESTAMP(3),
    "sentToday" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "bounceRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "spamRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "healthScore" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),
    "signature" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPassCipher" TEXT,
    "oauthTokenCipher" TEXT,
    "domainId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColdMailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColdProspectList" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "validCount" INTEGER NOT NULL DEFAULT 0,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "riskyCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColdProspectList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColdProspect" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "contactId" TEXT,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "companyName" TEXT,
    "jobTitle" TEXT,
    "customVar1" TEXT,
    "customVar2" TEXT,
    "customVar3" TEXT,
    "customVar4" TEXT,
    "customVar5" TEXT,
    "validationStatus" "ProspectValidation" NOT NULL DEFAULT 'pending',
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ColdProspect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColdCampaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "status" "ColdCampaignStatus" NOT NULL DEFAULT 'draft',
    "listId" TEXT,
    "stopOnReply" BOOLEAN NOT NULL DEFAULT true,
    "stopOnUnsubscribe" BOOLEAN NOT NULL DEFAULT true,
    "trackOpens" BOOLEAN NOT NULL DEFAULT false,
    "trackClicks" BOOLEAN NOT NULL DEFAULT false,
    "trackingDomain" TEXT,
    "totalProspects" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "positiveReplyCount" INTEGER NOT NULL DEFAULT 0,
    "bounceCount" INTEGER NOT NULL DEFAULT 0,
    "unsubCount" INTEGER NOT NULL DEFAULT 0,
    "pipelineValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dealsCreated" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColdCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColdSequenceStep" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "delayDays" INTEGER NOT NULL DEFAULT 2,
    "useThreading" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColdSequenceStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColdCampaignMailbox" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,

    CONSTRAINT "ColdCampaignMailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColdSequenceState" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "currentStepId" TEXT,
    "status" "ColdProspectStatus" NOT NULL DEFAULT 'queued',
    "processingStartedAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3),
    "nextSendAfter" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ColdSequenceState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColdEmailEvent" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "prospectId" TEXT,
    "stepOrder" INTEGER,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ColdEmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailProviderCredential" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "providerType" "EmailProviderType" NOT NULL,
    "authMethod" TEXT NOT NULL DEFAULT 'service_account',
    "adminEmailCipher" TEXT,
    "serviceAccountCipher" TEXT,
    "accessTokenCipher" TEXT,
    "refreshTokenCipher" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "msTenantIdCipher" TEXT,
    "clientIdCipher" TEXT,
    "clientSecretCipher" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailProviderCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailFinderCredential" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "providerType" TEXT NOT NULL DEFAULT 'apollo',
    "apiKeyCipher" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailFinderCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderExternalAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "credentialId" TEXT,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderExternalAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailboxProvisioningLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domainId" TEXT,
    "mailboxId" TEXT,
    "provider" "EmailProviderType" NOT NULL,
    "email" TEXT NOT NULL,
    "status" "ProvisioningStatus" NOT NULL DEFAULT 'pending',
    "externalId" TEXT,
    "temporaryPasswordCipher" TEXT,
    "failureReason" TEXT,
    "rollbackReason" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailboxProvisioningLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DnsProvisioningLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domainId" TEXT,
    "provider" "DnsProviderType" NOT NULL,
    "recordType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "status" "ProvisioningStatus" NOT NULL DEFAULT 'pending',
    "externalId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DnsProvisioningLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Persona" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "mailboxId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "jobTitle" TEXT,
    "companyName" TEXT,
    "phone" TEXT,
    "profilePhoto" TEXT,
    "signature" TEXT,
    "warmupStatus" "WarmupStatus" NOT NULL DEFAULT 'not_started',
    "warmupDay" INTEGER NOT NULL DEFAULT 0,
    "healthScore" INTEGER NOT NULL DEFAULT 0,
    "dailySendLimit" INTEGER NOT NULL DEFAULT 5,
    "sentToday" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "bounceRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "spamRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "linkedinConnected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedInSlot" (
    "id" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "profileUrl" TEXT,
    "headline" TEXT,
    "suggestedBio" TEXT,
    "connectionLimit" INTEGER NOT NULL DEFAULT 20,
    "messageLimit" INTEGER NOT NULL DEFAULT 50,
    "connectionsCount" INTEGER NOT NULL DEFAULT 0,
    "messagesSent" INTEGER NOT NULL DEFAULT 0,
    "replyRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedInSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarmupLog" (
    "id" TEXT NOT NULL,
    "personaId" TEXT,
    "mailboxId" TEXT,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailsSent" INTEGER NOT NULL DEFAULT 0,
    "emailsReceived" INTEGER NOT NULL DEFAULT 0,
    "repliesReceived" INTEGER NOT NULL DEFAULT 0,
    "spamCount" INTEGER NOT NULL DEFAULT 0,
    "bounceCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WarmupLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SendingLog" (
    "id" TEXT NOT NULL,
    "personaId" TEXT,
    "mailboxId" TEXT,
    "campaignId" TEXT,
    "prospectId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "openTracked" BOOLEAN NOT NULL DEFAULT false,
    "clickTracked" BOOLEAN NOT NULL DEFAULT false,
    "repliedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),

    CONSTRAINT "SendingLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainHealthLog" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blacklistStatus" TEXT NOT NULL DEFAULT 'clean',
    "spfValid" BOOLEAN NOT NULL DEFAULT false,
    "dkimValid" BOOLEAN NOT NULL DEFAULT false,
    "dmarcValid" BOOLEAN NOT NULL DEFAULT false,
    "healthScore" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DomainHealthLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainPurchaseOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "baseName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "registrarProvider" TEXT NOT NULL DEFAULT 'namecheap',
    "status" "DomainPurchaseStatus" NOT NULL DEFAULT 'generating',
    "domains" JSONB NOT NULL DEFAULT '[]',
    "totalCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "emailFormat" TEXT NOT NULL DEFAULT 'firstname.lastname',
    "mailboxesPerDomain" INTEGER NOT NULL DEFAULT 1,
    "companyName" TEXT,
    "jobTitle" TEXT,
    "whoisContact" JSONB,
    "providerCredentialId" TEXT,
    "lastError" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DomainPurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColdReply" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "campaignId" TEXT,
    "prospectId" TEXT,
    "mailboxId" TEXT,
    "fromEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'uncategorized',
    "assignedTo" TEXT,
    "respondedAt" TIMESTAMP(3),
    "crmDealId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ColdReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColdSequenceTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColdSequenceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT,
    "dealId" TEXT,
    "provider" TEXT,
    "providerCallId" TEXT,
    "title" TEXT NOT NULL,
    "status" "CallSessionStatus" NOT NULL DEFAULT 'uploaded',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallRecording" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "durationSec" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallRecording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallTranscript" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "language" TEXT,
    "text" TEXT NOT NULL,
    "speakerLabels" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallInsight" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "objections" JSONB,
    "actionItems" JSONB,
    "sentiment" TEXT,
    "coachingScore" INTEGER,
    "followUpEmail" TEXT,
    "model" TEXT,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "costEstimate" DECIMAL(12,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantQuota" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "limitValue" INTEGER NOT NULL,
    "currentUsage" INTEGER NOT NULL DEFAULT 0,
    "warnAt" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "items" JSONB NOT NULL DEFAULT '[]',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MccSetting" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT 'NexusHQ',
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#1a56db',
    "supportEmail" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "notificationSenderName" TEXT,
    "notificationSenderEmail" TEXT,
    "whitelabelEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whitelabelDomain" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MccSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metric" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notifyAdmin" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantContract" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contractType" TEXT NOT NULL DEFAULT 'subscription',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "renewalDate" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "terms" TEXT,
    "documentUrl" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NpsSurvey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "score" INTEGER NOT NULL,
    "feedback" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NpsSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "defaultOn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantFeatureFlag" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantFeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "TenantUser_userId_idx" ON "TenantUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantUser_tenantId_userId_key" ON "TenantUser"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantService_tenantId_key_key" ON "TenantService"("tenantId", "key");

-- CreateIndex
CREATE INDEX "PlanCatalogService_serviceKey_idx" ON "PlanCatalogService"("serviceKey");

-- CreateIndex
CREATE UNIQUE INDEX "PlanCatalogService_planKey_serviceKey_key" ON "PlanCatalogService"("planKey", "serviceKey");

-- CreateIndex
CREATE INDEX "TenantIntegration_tenantId_idx" ON "TenantIntegration"("tenantId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Contact_tenantId_status_idx" ON "Contact"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Contact_tenantId_companyId_idx" ON "Contact"("tenantId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_tenantId_email_key" ON "Contact"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Company_tenantId_name_idx" ON "Company"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Deal_tenantId_status_idx" ON "Deal"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Deal_tenantId_companyId_idx" ON "Deal"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX "Deal_tenantId_stage_idx" ON "Deal"("tenantId", "stage");

-- CreateIndex
CREATE INDEX "PipelineStage_tenantId_order_idx" ON "PipelineStage"("tenantId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStage_tenantId_name_key" ON "PipelineStage"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Tag_tenantId_idx" ON "Tag"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_tenantId_name_key" ON "Tag"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Activity_tenantId_createdAt_idx" ON "Activity"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_tenantId_contactId_idx" ON "Activity"("tenantId", "contactId");

-- CreateIndex
CREATE INDEX "Activity_tenantId_companyId_idx" ON "Activity"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX "Activity_tenantId_dealId_idx" ON "Activity"("tenantId", "dealId");

-- CreateIndex
CREATE INDEX "EmailTemplate_tenantId_createdAt_idx" ON "EmailTemplate"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "TemplateVersion_templateId_version_idx" ON "TemplateVersion"("templateId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateVersion_templateId_version_key" ON "TemplateVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "EmailCampaign_tenantId_status_idx" ON "EmailCampaign"("tenantId", "status");

-- CreateIndex
CREATE INDEX "EmailCampaign_tenantId_createdAt_idx" ON "EmailCampaign"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignRecipient_campaignId_idx" ON "CampaignRecipient"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignRecipient_campaignId_status_idx" ON "CampaignRecipient"("campaignId", "status");

-- CreateIndex
CREATE INDEX "EmailEvent_campaignId_type_idx" ON "EmailEvent"("campaignId", "type");

-- CreateIndex
CREATE INDEX "EmailEvent_campaignId_occurredAt_idx" ON "EmailEvent"("campaignId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailEvent_providerId_key" ON "EmailEvent"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailEvent_eventKey_key" ON "EmailEvent"("eventKey");

-- CreateIndex
CREATE INDEX "EmailAutomation_tenantId_status_idx" ON "EmailAutomation"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AutomationStep_automationId_stepOrder_idx" ON "AutomationStep"("automationId", "stepOrder");

-- CreateIndex
CREATE INDEX "AutomationExecution_automationId_status_idx" ON "AutomationExecution"("automationId", "status");

-- CreateIndex
CREATE INDEX "AutomationExecution_status_nextRunAt_idx" ON "AutomationExecution"("status", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationExecution_automationId_contactId_key" ON "AutomationExecution"("automationId", "contactId");

-- CreateIndex
CREATE INDEX "EmailSegment_tenantId_idx" ON "EmailSegment"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSubscription_stripeSubscriptionId_key" ON "BillingSubscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "BillingSubscription_tenantId_status_idx" ON "BillingSubscription"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_stripeInvoiceId_key" ON "Invoice"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_createdAt_idx" ON "Invoice"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethodRef_stripePaymentMethodId_key" ON "PaymentMethodRef"("stripePaymentMethodId");

-- CreateIndex
CREATE INDEX "PaymentMethodRef_tenantId_idx" ON "PaymentMethodRef"("tenantId");

-- CreateIndex
CREATE INDEX "UsageRecord_tenantId_service_period_idx" ON "UsageRecord"("tenantId", "service", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_proposalNumber_key" ON "Proposal"("proposalNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_trackingToken_key" ON "Proposal"("trackingToken");

-- CreateIndex
CREATE INDEX "Proposal_tenantId_status_idx" ON "Proposal"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Proposal_scope_createdAt_idx" ON "Proposal"("scope", "createdAt");

-- CreateIndex
CREATE INDEX "Proposal_trackingToken_idx" ON "Proposal"("trackingToken");

-- CreateIndex
CREATE INDEX "ProposalLineItem_proposalId_idx" ON "ProposalLineItem"("proposalId");

-- CreateIndex
CREATE INDEX "ProposalService_proposalId_idx" ON "ProposalService"("proposalId");

-- CreateIndex
CREATE INDEX "ProposalSection_proposalId_idx" ON "ProposalSection"("proposalId");

-- CreateIndex
CREATE INDEX "ProposalActivity_proposalId_createdAt_idx" ON "ProposalActivity"("proposalId", "createdAt");

-- CreateIndex
CREATE INDEX "ProposalTemplate_tenantId_scope_idx" ON "ProposalTemplate"("tenantId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "ClientBrandSetting_tenantId_key" ON "ClientBrandSetting"("tenantId");

-- CreateIndex
CREATE INDEX "ClientServicePricing_tenantId_idx" ON "ClientServicePricing"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientServicePricing_tenantId_serviceType_planName_key" ON "ClientServicePricing"("tenantId", "serviceType", "planName");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceInvoice_publicToken_key" ON "FinanceInvoice"("publicToken");

-- CreateIndex
CREATE INDEX "FinanceInvoice_tenantId_status_idx" ON "FinanceInvoice"("tenantId", "status");

-- CreateIndex
CREATE INDEX "FinanceInvoice_scope_createdAt_idx" ON "FinanceInvoice"("scope", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceInvoice_publicToken_idx" ON "FinanceInvoice"("publicToken");

-- CreateIndex
CREATE INDEX "FinanceInvoice_proposalId_idx" ON "FinanceInvoice"("proposalId");

-- CreateIndex
CREATE INDEX "FinanceInvoice_subscriptionId_idx" ON "FinanceInvoice"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceInvoice_scope_tenantId_number_key" ON "FinanceInvoice"("scope", "tenantId", "number");

-- CreateIndex
CREATE INDEX "FinanceInvoiceLineItem_invoiceId_idx" ON "FinanceInvoiceLineItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePayment_reference_key" ON "FinancePayment"("reference");

-- CreateIndex
CREATE INDEX "FinancePayment_tenantId_status_idx" ON "FinancePayment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "FinancePayment_invoiceId_idx" ON "FinancePayment"("invoiceId");

-- CreateIndex
CREATE INDEX "FinancePayment_scope_createdAt_idx" ON "FinancePayment"("scope", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceCost_tenantId_status_idx" ON "FinanceCost"("tenantId", "status");

-- CreateIndex
CREATE INDEX "FinanceCost_scope_createdAt_idx" ON "FinanceCost"("scope", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceSubscription_tenantId_status_idx" ON "FinanceSubscription"("tenantId", "status");

-- CreateIndex
CREATE INDEX "FinanceSubscription_scope_nextBillingDate_idx" ON "FinanceSubscription"("scope", "nextBillingDate");

-- CreateIndex
CREATE INDEX "FinanceSubscriptionService_subscriptionId_idx" ON "FinanceSubscriptionService"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceRefund_creditNoteNumber_key" ON "FinanceRefund"("creditNoteNumber");

-- CreateIndex
CREATE INDEX "FinanceRefund_tenantId_status_idx" ON "FinanceRefund"("tenantId", "status");

-- CreateIndex
CREATE INDEX "FinanceRefund_invoiceId_idx" ON "FinanceRefund"("invoiceId");

-- CreateIndex
CREATE INDEX "FinanceTaxConfig_tenantId_isActive_idx" ON "FinanceTaxConfig"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceSetting_tenantId_key" ON "FinanceSetting"("tenantId");

-- CreateIndex
CREATE INDEX "FinanceSetting_scope_idx" ON "FinanceSetting"("scope");

-- CreateIndex
CREATE INDEX "FinanceInvoiceActivity_invoiceId_createdAt_idx" ON "FinanceInvoiceActivity"("invoiceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceSequence_scope_tenantId_sequenceType_year_key" ON "FinanceSequence"("scope", "tenantId", "sequenceType", "year");

-- CreateIndex
CREATE UNIQUE INDEX "TenantInvite_tokenHash_key" ON "TenantInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "TenantInvite_tenantId_status_idx" ON "TenantInvite"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TenantInvite_tenantId_email_status_key" ON "TenantInvite"("tenantId", "email", "status");

-- CreateIndex
CREATE INDEX "JobLog_tenantId_status_idx" ON "JobLog"("tenantId", "status");

-- CreateIndex
CREATE INDEX "JobLog_queue_status_scheduledAt_idx" ON "JobLog"("queue", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "ProviderLog_tenantId_provider_createdAt_idx" ON "ProviderLog"("tenantId", "provider", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_tenantId_readAt_createdAt_idx" ON "Notification"("tenantId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_tenantId_userId_type_key" ON "NotificationPreference"("tenantId", "userId", "type");

-- CreateIndex
CREATE INDEX "SuppressionEntry_tenantId_source_idx" ON "SuppressionEntry"("tenantId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "SuppressionEntry_tenantId_email_key" ON "SuppressionEntry"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "UnsubscribeToken_tokenHash_key" ON "UnsubscribeToken"("tokenHash");

-- CreateIndex
CREATE INDEX "UnsubscribeToken_tenantId_email_idx" ON "UnsubscribeToken"("tenantId", "email");

-- CreateIndex
CREATE INDEX "UnsubscribeToken_purpose_campaignId_recipientId_idx" ON "UnsubscribeToken"("purpose", "campaignId", "recipientId");

-- CreateIndex
CREATE INDEX "SubscriptionPreference_tenantId_email_idx" ON "SubscriptionPreference"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPreference_tenantId_email_category_key" ON "SubscriptionPreference"("tenantId", "email", "category");

-- CreateIndex
CREATE INDEX "ComplianceLog_tenantId_email_idx" ON "ComplianceLog"("tenantId", "email");

-- CreateIndex
CREATE INDEX "ComplianceLog_tenantId_occurredAt_idx" ON "ComplianceLog"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "ScheduledReport_tenantId_idx" ON "ScheduledReport"("tenantId");

-- CreateIndex
CREATE INDEX "ScheduledReport_enabled_nextSendAt_idx" ON "ScheduledReport"("enabled", "nextSendAt");

-- CreateIndex
CREATE INDEX "TrackingEvent_tenantId_type_occurredAt_idx" ON "TrackingEvent"("tenantId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "TrackingEvent_token_idx" ON "TrackingEvent"("token");

-- CreateIndex
CREATE INDEX "AiSession_tenantId_userId_idx" ON "AiSession"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "AiMessage_sessionId_timestamp_idx" ON "AiMessage"("sessionId", "timestamp");

-- CreateIndex
CREATE INDEX "AiUsageEvent_tenantId_userId_createdAt_idx" ON "AiUsageEvent"("tenantId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "SendingDomain_tenantId_idx" ON "SendingDomain"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SendingDomain_tenantId_domain_key" ON "SendingDomain"("tenantId", "domain");

-- CreateIndex
CREATE INDEX "ColdMailbox_tenantId_status_idx" ON "ColdMailbox"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ColdMailbox_tenantId_email_key" ON "ColdMailbox"("tenantId", "email");

-- CreateIndex
CREATE INDEX "ColdProspectList_tenantId_createdAt_idx" ON "ColdProspectList"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ColdProspect_listId_validationStatus_idx" ON "ColdProspect"("listId", "validationStatus");

-- CreateIndex
CREATE INDEX "ColdProspect_contactId_idx" ON "ColdProspect"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "ColdProspect_listId_email_key" ON "ColdProspect"("listId", "email");

-- CreateIndex
CREATE INDEX "ColdCampaign_tenantId_status_idx" ON "ColdCampaign"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ColdCampaign_tenantId_createdAt_idx" ON "ColdCampaign"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ColdSequenceStep_campaignId_idx" ON "ColdSequenceStep"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "ColdSequenceStep_campaignId_stepOrder_key" ON "ColdSequenceStep"("campaignId", "stepOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ColdCampaignMailbox_campaignId_mailboxId_key" ON "ColdCampaignMailbox"("campaignId", "mailboxId");

-- CreateIndex
CREATE INDEX "ColdSequenceState_campaignId_status_idx" ON "ColdSequenceState"("campaignId", "status");

-- CreateIndex
CREATE INDEX "ColdSequenceState_nextSendAfter_idx" ON "ColdSequenceState"("nextSendAfter");

-- CreateIndex
CREATE UNIQUE INDEX "ColdSequenceState_campaignId_prospectId_key" ON "ColdSequenceState"("campaignId", "prospectId");

-- CreateIndex
CREATE INDEX "ColdEmailEvent_campaignId_type_idx" ON "ColdEmailEvent"("campaignId", "type");

-- CreateIndex
CREATE INDEX "ColdEmailEvent_campaignId_occurredAt_idx" ON "ColdEmailEvent"("campaignId", "occurredAt");

-- CreateIndex
CREATE INDEX "EmailProviderCredential_tenantId_idx" ON "EmailProviderCredential"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailProviderCredential_tenantId_providerType_key" ON "EmailProviderCredential"("tenantId", "providerType");

-- CreateIndex
CREATE INDEX "EmailFinderCredential_tenantId_idx" ON "EmailFinderCredential"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailFinderCredential_tenantId_providerType_key" ON "EmailFinderCredential"("tenantId", "providerType");

-- CreateIndex
CREATE INDEX "ProviderExternalAccount_tenantId_provider_idx" ON "ProviderExternalAccount"("tenantId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderExternalAccount_provider_externalId_key" ON "ProviderExternalAccount"("provider", "externalId");

-- CreateIndex
CREATE INDEX "MailboxProvisioningLog_tenantId_status_idx" ON "MailboxProvisioningLog"("tenantId", "status");

-- CreateIndex
CREATE INDEX "MailboxProvisioningLog_email_idx" ON "MailboxProvisioningLog"("email");

-- CreateIndex
CREATE INDEX "DnsProvisioningLog_tenantId_domainId_status_idx" ON "DnsProvisioningLog"("tenantId", "domainId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Persona_mailboxId_key" ON "Persona"("mailboxId");

-- CreateIndex
CREATE INDEX "Persona_tenantId_domainId_idx" ON "Persona"("tenantId", "domainId");

-- CreateIndex
CREATE INDEX "Persona_tenantId_warmupStatus_idx" ON "Persona"("tenantId", "warmupStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Persona_tenantId_email_key" ON "Persona"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedInSlot_personaId_key" ON "LinkedInSlot"("personaId");

-- CreateIndex
CREATE INDEX "WarmupLog_personaId_date_idx" ON "WarmupLog"("personaId", "date");

-- CreateIndex
CREATE INDEX "WarmupLog_mailboxId_date_idx" ON "WarmupLog"("mailboxId", "date");

-- CreateIndex
CREATE INDEX "SendingLog_personaId_sentAt_idx" ON "SendingLog"("personaId", "sentAt");

-- CreateIndex
CREATE INDEX "SendingLog_mailboxId_sentAt_idx" ON "SendingLog"("mailboxId", "sentAt");

-- CreateIndex
CREATE INDEX "SendingLog_campaignId_sentAt_idx" ON "SendingLog"("campaignId", "sentAt");

-- CreateIndex
CREATE INDEX "DomainHealthLog_domainId_checkedAt_idx" ON "DomainHealthLog"("domainId", "checkedAt");

-- CreateIndex
CREATE INDEX "DomainPurchaseOrder_tenantId_status_idx" ON "DomainPurchaseOrder"("tenantId", "status");

-- CreateIndex
CREATE INDEX "DomainPurchaseOrder_tenantId_createdAt_idx" ON "DomainPurchaseOrder"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ColdReply_tenantId_category_idx" ON "ColdReply"("tenantId", "category");

-- CreateIndex
CREATE INDEX "ColdReply_tenantId_receivedAt_idx" ON "ColdReply"("tenantId", "receivedAt");

-- CreateIndex
CREATE INDEX "ColdSequenceTemplate_tenantId_createdAt_idx" ON "ColdSequenceTemplate"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "CallSession_tenantId_createdAt_idx" ON "CallSession"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "CallSession_provider_providerCallId_idx" ON "CallSession"("provider", "providerCallId");

-- CreateIndex
CREATE INDEX "CallRecording_tenantId_sessionId_idx" ON "CallRecording"("tenantId", "sessionId");

-- CreateIndex
CREATE INDEX "CallTranscript_tenantId_sessionId_idx" ON "CallTranscript"("tenantId", "sessionId");

-- CreateIndex
CREATE INDEX "CallInsight_tenantId_sessionId_idx" ON "CallInsight"("tenantId", "sessionId");

-- CreateIndex
CREATE INDEX "OnboardingItem_tenantId_completedAt_idx" ON "OnboardingItem"("tenantId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingItem_tenantId_key_key" ON "OnboardingItem"("tenantId", "key");

-- CreateIndex
CREATE INDEX "TenantQuota_tenantId_idx" ON "TenantQuota"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantQuota_tenantId_resource_key" ON "TenantQuota"("tenantId", "resource");

-- CreateIndex
CREATE INDEX "AlertEvent_tenantId_createdAt_idx" ON "AlertEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AlertEvent_ruleId_idx" ON "AlertEvent"("ruleId");

-- CreateIndex
CREATE INDEX "TenantContract_tenantId_status_idx" ON "TenantContract"("tenantId", "status");

-- CreateIndex
CREATE INDEX "NpsSurvey_tenantId_createdAt_idx" ON "NpsSurvey"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "TenantFeatureFlag_tenantId_idx" ON "TenantFeatureFlag"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantFeatureFlag_tenantId_flagId_key" ON "TenantFeatureFlag"("tenantId", "flagId");

-- AddForeignKey
ALTER TABLE "TenantUser" ADD CONSTRAINT "TenantUser_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantUser" ADD CONSTRAINT "TenantUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantService" ADD CONSTRAINT "TenantService_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCatalogService" ADD CONSTRAINT "PlanCatalogService_planKey_fkey" FOREIGN KEY ("planKey") REFERENCES "PlanCatalog"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCatalogService" ADD CONSTRAINT "PlanCatalogService_serviceKey_fkey" FOREIGN KEY ("serviceKey") REFERENCES "ServiceCatalog"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantIntegration" ADD CONSTRAINT "TenantIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "EmailAutomation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailAutomation" ADD CONSTRAINT "EmailAutomation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationStep" ADD CONSTRAINT "AutomationStep_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "EmailAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "EmailAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSegment" ADD CONSTRAINT "EmailSegment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscription" ADD CONSTRAINT "BillingSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethodRef" ADD CONSTRAINT "PaymentMethodRef_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalLineItem" ADD CONSTRAINT "ProposalLineItem_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalService" ADD CONSTRAINT "ProposalService_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalSection" ADD CONSTRAINT "ProposalSection_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalActivity" ADD CONSTRAINT "ProposalActivity_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalTemplate" ADD CONSTRAINT "ProposalTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientBrandSetting" ADD CONSTRAINT "ClientBrandSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientServicePricing" ADD CONSTRAINT "ClientServicePricing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceInvoice" ADD CONSTRAINT "FinanceInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceInvoiceLineItem" ADD CONSTRAINT "FinanceInvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FinanceInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePayment" ADD CONSTRAINT "FinancePayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePayment" ADD CONSTRAINT "FinancePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FinanceInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCost" ADD CONSTRAINT "FinanceCost_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSubscription" ADD CONSTRAINT "FinanceSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSubscriptionService" ADD CONSTRAINT "FinanceSubscriptionService_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "FinanceSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRefund" ADD CONSTRAINT "FinanceRefund_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRefund" ADD CONSTRAINT "FinanceRefund_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FinanceInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRefund" ADD CONSTRAINT "FinanceRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "FinancePayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTaxConfig" ADD CONSTRAINT "FinanceTaxConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSetting" ADD CONSTRAINT "FinanceSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceInvoiceActivity" ADD CONSTRAINT "FinanceInvoiceActivity_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FinanceInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSequence" ADD CONSTRAINT "FinanceSequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantInvite" ADD CONSTRAINT "TenantInvite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantInvite" ADD CONSTRAINT "TenantInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobLog" ADD CONSTRAINT "JobLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderLog" ADD CONSTRAINT "ProviderLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuppressionEntry" ADD CONSTRAINT "SuppressionEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPreference" ADD CONSTRAINT "SubscriptionPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceLog" ADD CONSTRAINT "ComplianceLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledReport" ADD CONSTRAINT "ScheduledReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSession" ADD CONSTRAINT "AiSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SendingDomain" ADD CONSTRAINT "SendingDomain_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SendingDomain" ADD CONSTRAINT "SendingDomain_providerCredentialId_fkey" FOREIGN KEY ("providerCredentialId") REFERENCES "EmailProviderCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdMailbox" ADD CONSTRAINT "ColdMailbox_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdMailbox" ADD CONSTRAINT "ColdMailbox_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "SendingDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdProspectList" ADD CONSTRAINT "ColdProspectList_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdProspect" ADD CONSTRAINT "ColdProspect_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ColdProspectList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdProspect" ADD CONSTRAINT "ColdProspect_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdCampaign" ADD CONSTRAINT "ColdCampaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdCampaign" ADD CONSTRAINT "ColdCampaign_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ColdProspectList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdSequenceStep" ADD CONSTRAINT "ColdSequenceStep_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ColdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdCampaignMailbox" ADD CONSTRAINT "ColdCampaignMailbox_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ColdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdCampaignMailbox" ADD CONSTRAINT "ColdCampaignMailbox_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "ColdMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdSequenceState" ADD CONSTRAINT "ColdSequenceState_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ColdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdSequenceState" ADD CONSTRAINT "ColdSequenceState_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "ColdProspect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdSequenceState" ADD CONSTRAINT "ColdSequenceState_currentStepId_fkey" FOREIGN KEY ("currentStepId") REFERENCES "ColdSequenceStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdEmailEvent" ADD CONSTRAINT "ColdEmailEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ColdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailProviderCredential" ADD CONSTRAINT "EmailProviderCredential_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailFinderCredential" ADD CONSTRAINT "EmailFinderCredential_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderExternalAccount" ADD CONSTRAINT "ProviderExternalAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderExternalAccount" ADD CONSTRAINT "ProviderExternalAccount_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "EmailProviderCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailboxProvisioningLog" ADD CONSTRAINT "MailboxProvisioningLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DnsProvisioningLog" ADD CONSTRAINT "DnsProvisioningLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "SendingDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "ColdMailbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedInSlot" ADD CONSTRAINT "LinkedInSlot_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupLog" ADD CONSTRAINT "WarmupLog_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupLog" ADD CONSTRAINT "WarmupLog_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "ColdMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SendingLog" ADD CONSTRAINT "SendingLog_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SendingLog" ADD CONSTRAINT "SendingLog_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "ColdMailbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainHealthLog" ADD CONSTRAINT "DomainHealthLog_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "SendingDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainPurchaseOrder" ADD CONSTRAINT "DomainPurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainPurchaseOrder" ADD CONSTRAINT "DomainPurchaseOrder_providerCredentialId_fkey" FOREIGN KEY ("providerCredentialId") REFERENCES "EmailProviderCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdReply" ADD CONSTRAINT "ColdReply_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallRecording" ADD CONSTRAINT "CallRecording_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallRecording" ADD CONSTRAINT "CallRecording_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallTranscript" ADD CONSTRAINT "CallTranscript_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallTranscript" ADD CONSTRAINT "CallTranscript_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallInsight" ADD CONSTRAINT "CallInsight_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallInsight" ADD CONSTRAINT "CallInsight_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingItem" ADD CONSTRAINT "OnboardingItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantQuota" ADD CONSTRAINT "TenantQuota_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantContract" ADD CONSTRAINT "TenantContract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NpsSurvey" ADD CONSTRAINT "NpsSurvey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantFeatureFlag" ADD CONSTRAINT "TenantFeatureFlag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantFeatureFlag" ADD CONSTRAINT "TenantFeatureFlag_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "FeatureFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
