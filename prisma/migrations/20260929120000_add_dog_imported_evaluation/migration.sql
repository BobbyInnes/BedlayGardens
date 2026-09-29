-- AlterTable
ALTER TABLE "Dog" ADD COLUMN     "importedEvaluationComplete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "importedEvaluationDate" TIMESTAMP(3),
ADD COLUMN     "importedEvaluationNotes" TEXT;
