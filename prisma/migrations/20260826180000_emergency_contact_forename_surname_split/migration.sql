-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emergencyContactSalutation" TEXT;
ALTER TABLE "User" ADD COLUMN     "emergencyContactForename" TEXT;
ALTER TABLE "User" ADD COLUMN     "emergencyContactSurname" TEXT;
ALTER TABLE "User" ADD COLUMN     "emergencyContactHomePhone" TEXT;
ALTER TABLE "User" ADD COLUMN     "emergencyContactWorkPhone" TEXT;

-- Backfill forename/surname by splitting the existing "emergencyContactName"
-- on the first space — single-word names go entirely into forename, surname
-- becomes ''. Rows with no emergencyContactName stay NULL.
UPDATE "User" SET
  "emergencyContactForename" = CASE
    WHEN "emergencyContactName" IS NULL THEN NULL
    WHEN position(' ' in "emergencyContactName") > 0 THEN substring("emergencyContactName" from 1 for position(' ' in "emergencyContactName") - 1)
    ELSE "emergencyContactName"
  END,
  "emergencyContactSurname" = CASE
    WHEN "emergencyContactName" IS NULL THEN NULL
    WHEN position(' ' in "emergencyContactName") > 0 THEN substring("emergencyContactName" from position(' ' in "emergencyContactName") + 1)
    ELSE ''
  END
WHERE "emergencyContactName" IS NOT NULL;

-- Drop the old single-field name column
ALTER TABLE "User" DROP COLUMN "emergencyContactName";
