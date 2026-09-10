-- CreateEnum
CREATE TYPE "WalkType" AS ENUM ('GROUP_WALK', 'SOLO_WALK', 'PUPPY_WALK_AND_PLAY');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "walkType" "WalkType",
ADD COLUMN     "pickupAddress" TEXT,
ADD COLUMN     "accessNotes" TEXT;

-- CreateIndex
CREATE INDEX "Booking_serviceId_startDate_idx" ON "Booking"("serviceId", "startDate");
