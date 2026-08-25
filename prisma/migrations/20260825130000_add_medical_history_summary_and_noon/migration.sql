-- AlterTable
ALTER TABLE "Dog" ADD COLUMN     "medicalHistorySummary" TEXT;

-- AlterTable
ALTER TABLE "DogMedication" ADD COLUMN     "noon" BOOLEAN NOT NULL DEFAULT false;
