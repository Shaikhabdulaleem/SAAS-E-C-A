ALTER TABLE "SendingDomain" ADD COLUMN "dkimSelector" TEXT;
ALTER TABLE "SendingDomain" ADD COLUMN "dkimType" TEXT;
ALTER TABLE "SendingDomain" ADD COLUMN "dkimHost" TEXT;
ALTER TABLE "SendingDomain" ADD COLUMN "dkimValue" TEXT;
ALTER TABLE "SendingDomain" ADD COLUMN "trackingCnameValue" TEXT;
