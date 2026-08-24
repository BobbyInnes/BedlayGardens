-- AlterTable: add the new structured fields first (old emergencyContact column
-- is dropped separately below, only after its data has been preserved).
ALTER TABLE "Dog"
ADD COLUMN     "allergies" TEXT,
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
ADD COLUMN     "vetPostcode" TEXT,
ADD COLUMN     "vetPracticeName" TEXT;

-- Preserve existing free-text emergency contact data (unsplit "Name and phone
-- number") into the new Name field before the old column is dropped, so no
-- data is lost — customers can tidy it into the separate fields later.
UPDATE "Dog" SET "emergencyContactName" = "emergencyContact"
WHERE "emergencyContact" IS NOT NULL AND trim("emergencyContact") <> '';

-- Drop the old free-text column now that its data has been preserved above.
ALTER TABLE "Dog" DROP COLUMN "emergencyContact";
