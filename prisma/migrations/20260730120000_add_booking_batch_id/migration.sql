-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "batchId" TEXT;

-- CreateIndex
CREATE INDEX "Booking_batchId_idx" ON "Booking"("batchId");
