ALTER TABLE "Tenant" ADD COLUMN "customPriceEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN "customMrr" DECIMAL(10,2);
ALTER TABLE "Tenant" ADD COLUMN "discountType" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Tenant" ADD COLUMN "discountValue" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Tenant" ADD COLUMN "discountReason" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "discountExpiresAt" TIMESTAMP(3);

CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenantId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'client',
    "title" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "companyName" TEXT,
    "contactId" TEXT,
    "companyId" TEXT,
    "dealId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountType" TEXT NOT NULL DEFAULT 'none',
    "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "validUntil" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalLineItem" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "proposalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    CONSTRAINT "ProposalLineItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceInvoice" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenantId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'client',
    "number" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountType" TEXT NOT NULL DEFAULT 'none',
    "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinanceInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceInvoiceLineItem" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "invoiceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    CONSTRAINT "FinanceInvoiceLineItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancePayment" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenantId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'client',
    "invoiceId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" TEXT,
    "status" TEXT NOT NULL DEFAULT 'received',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancePayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceCost" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
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

CREATE INDEX "Proposal_tenantId_status_idx" ON "Proposal"("tenantId", "status");
CREATE INDEX "Proposal_scope_createdAt_idx" ON "Proposal"("scope", "createdAt");
CREATE INDEX "ProposalLineItem_proposalId_idx" ON "ProposalLineItem"("proposalId");
CREATE UNIQUE INDEX "FinanceInvoice_scope_tenantId_number_key" ON "FinanceInvoice"("scope", "tenantId", "number");
CREATE INDEX "FinanceInvoice_tenantId_status_idx" ON "FinanceInvoice"("tenantId", "status");
CREATE INDEX "FinanceInvoice_scope_createdAt_idx" ON "FinanceInvoice"("scope", "createdAt");
CREATE INDEX "FinanceInvoiceLineItem_invoiceId_idx" ON "FinanceInvoiceLineItem"("invoiceId");
CREATE INDEX "FinancePayment_tenantId_status_idx" ON "FinancePayment"("tenantId", "status");
CREATE INDEX "FinancePayment_invoiceId_idx" ON "FinancePayment"("invoiceId");
CREATE INDEX "FinancePayment_scope_createdAt_idx" ON "FinancePayment"("scope", "createdAt");
CREATE INDEX "FinanceCost_tenantId_status_idx" ON "FinanceCost"("tenantId", "status");
CREATE INDEX "FinanceCost_scope_createdAt_idx" ON "FinanceCost"("scope", "createdAt");

ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalLineItem" ADD CONSTRAINT "ProposalLineItem_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceInvoice" ADD CONSTRAINT "FinanceInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceInvoiceLineItem" ADD CONSTRAINT "FinanceInvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FinanceInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancePayment" ADD CONSTRAINT "FinancePayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancePayment" ADD CONSTRAINT "FinancePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FinanceInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceCost" ADD CONSTRAINT "FinanceCost_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
