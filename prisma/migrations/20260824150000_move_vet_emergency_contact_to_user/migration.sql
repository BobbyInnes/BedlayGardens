-- AlterTable: add the account-level fields to User first.
ALTER TABLE "User"
ADD COLUMN     "emergencyContactAddressLine1" TEXT,
ADD COLUMN     "emergencyContactAddressLine2" TEXT,
ADD COLUMN     "emergencyContactCity" TEXT,
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "emergencyContactPostcode" TEXT,
ADD COLUMN     "vetAddressLine1" TEXT,
ADD COLUMN     "vetAddressLine2" TEXT,
ADD COLUMN     "vetCity" TEXT,
ADD COLUMN     "vetEmail" TEXT,
ADD COLUMN     "vetName" TEXT,
ADD COLUMN     "vetPhone" TEXT,
ADD COLUMN     "vetPostcode" TEXT,
ADD COLUMN     "vetPracticeName" TEXT;

-- Consolidate existing per-dog vet/emergency contact data onto each owner's
-- account, using each owner's most recently created dog as the source.
-- Per-dog differences (a customer with multiple dogs on different vets) are
-- intentionally discarded here in favour of a single account-level value.
WITH latest_dog AS (
  SELECT DISTINCT ON ("ownerId") *
  FROM "Dog"
  ORDER BY "ownerId", "createdAt" DESC
)
UPDATE "User" u
SET
  "emergencyContactName" = ld."emergencyContactName",
  "emergencyContactPhone" = ld."emergencyContactPhone",
  "emergencyContactAddressLine1" = ld."emergencyContactAddressLine1",
  "emergencyContactAddressLine2" = ld."emergencyContactAddressLine2",
  "emergencyContactCity" = ld."emergencyContactCity",
  "emergencyContactPostcode" = ld."emergencyContactPostcode",
  "vetName" = ld."vetName",
  "vetPhone" = ld."vetPhone",
  "vetPracticeName" = ld."vetPracticeName",
  "vetAddressLine1" = ld."vetAddressLine1",
  "vetAddressLine2" = ld."vetAddressLine2",
  "vetCity" = ld."vetCity",
  "vetPostcode" = ld."vetPostcode",
  "vetEmail" = ld."vetEmail"
FROM latest_dog ld
WHERE ld."ownerId" = u.id;

-- Drop the now-account-level fields from Dog.
ALTER TABLE "Dog"
DROP COLUMN "emergencyContactAddressLine1",
DROP COLUMN "emergencyContactAddressLine2",
DROP COLUMN "emergencyContactCity",
DROP COLUMN "emergencyContactName",
DROP COLUMN "emergencyContactPhone",
DROP COLUMN "emergencyContactPostcode",
DROP COLUMN "vetAddressLine1",
DROP COLUMN "vetAddressLine2",
DROP COLUMN "vetCity",
DROP COLUMN "vetEmail",
DROP COLUMN "vetName",
DROP COLUMN "vetPhone",
DROP COLUMN "vetPostcode",
DROP COLUMN "vetPracticeName";
