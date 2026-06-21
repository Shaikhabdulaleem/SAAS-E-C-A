ALTER TABLE "Contact"
ADD COLUMN "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "marketingConsentSource" TEXT,
ADD COLUMN "marketingConsentCapturedAt" TIMESTAMP(3);
