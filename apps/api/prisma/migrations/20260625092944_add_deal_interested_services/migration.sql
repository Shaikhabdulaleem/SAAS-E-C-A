-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "interestedServices" TEXT[] DEFAULT ARRAY[]::TEXT[];
