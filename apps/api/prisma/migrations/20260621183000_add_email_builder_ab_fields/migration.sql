ALTER TABLE "EmailTemplate"
ADD COLUMN "contentBlocks" JSONB;

ALTER TABLE "EmailCampaign"
ADD COLUMN "contentBlocks" JSONB,
ADD COLUMN "abTestEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "abVariants" JSONB,
ADD COLUMN "selectedVariant" TEXT;
