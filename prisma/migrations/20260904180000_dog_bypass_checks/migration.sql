-- AlterTable
ALTER TABLE "Dog" ADD COLUMN     "bypassVaccinationChecks" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bypassMeetGreetChecks" BOOLEAN NOT NULL DEFAULT false;
