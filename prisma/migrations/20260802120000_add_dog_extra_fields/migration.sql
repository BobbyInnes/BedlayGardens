-- AlterTable
ALTER TABLE "Dog" ADD COLUMN     "color" TEXT,
ADD COLUMN     "groupPlayApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "microchipNumber" TEXT,
ADD COLUMN     "runType" TEXT,
ADD COLUMN     "temperament" TEXT;
