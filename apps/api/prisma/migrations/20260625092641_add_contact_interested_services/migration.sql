-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "interestedServices" TEXT[] DEFAULT ARRAY[]::TEXT[];
