-- AlterTable
ALTER TABLE "User" ADD COLUMN     "salutation" TEXT;
ALTER TABLE "User" ADD COLUMN     "forename" TEXT;
ALTER TABLE "User" ADD COLUMN     "surname" TEXT;
ALTER TABLE "User" ADD COLUMN     "homePhone" TEXT;

-- Backfill forename/surname by splitting the existing "name" on the first
-- space — single-word names go entirely into forename, surname becomes ''.
UPDATE "User" SET
  "forename" = CASE WHEN position(' ' in "name") > 0 THEN substring("name" from 1 for position(' ' in "name") - 1) ELSE "name" END,
  "surname"  = CASE WHEN position(' ' in "name") > 0 THEN substring("name" from position(' ' in "name") + 1) ELSE '' END;

-- Make the new name columns required now that every row is backfilled
ALTER TABLE "User" ALTER COLUMN "forename" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "surname" SET NOT NULL;

-- Drop the old single-field name column
ALTER TABLE "User" DROP COLUMN "name";
