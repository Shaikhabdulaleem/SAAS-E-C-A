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

CREATE TABLE "PlanCatalogService" (
    "id" TEXT NOT NULL,
    "planKey" "PlanKey" NOT NULL,
    "serviceKey" TEXT NOT NULL,

    CONSTRAINT "PlanCatalogService_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanCatalogService_planKey_serviceKey_key" ON "PlanCatalogService"("planKey", "serviceKey");
CREATE INDEX "PlanCatalogService_serviceKey_idx" ON "PlanCatalogService"("serviceKey");

ALTER TABLE "PlanCatalogService" ADD CONSTRAINT "PlanCatalogService_planKey_fkey" FOREIGN KEY ("planKey") REFERENCES "PlanCatalog"("key") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanCatalogService" ADD CONSTRAINT "PlanCatalogService_serviceKey_fkey" FOREIGN KEY ("serviceKey") REFERENCES "ServiceCatalog"("key") ON DELETE CASCADE ON UPDATE CASCADE;
