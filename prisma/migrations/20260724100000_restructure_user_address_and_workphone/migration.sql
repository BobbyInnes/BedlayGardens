-- AlterTable
ALTER TABLE "User" ADD COLUMN     "workPhone" TEXT,
ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "addressCity" TEXT,
ADD COLUMN     "addressPostcode" TEXT;

-- Migrate existing free-text address into addressLine1 before dropping it
UPDATE "User" SET "addressLine1" = "address" WHERE "address" IS NOT NULL;

-- DropColumn
ALTER TABLE "User" DROP COLUMN "address";
