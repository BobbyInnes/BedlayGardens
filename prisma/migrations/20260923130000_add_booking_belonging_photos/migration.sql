-- CreateTable
CREATE TABLE "BookingBelongingPhoto" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingBelongingPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingBelongingPhoto_bookingId_idx" ON "BookingBelongingPhoto"("bookingId");

-- CreateIndex
CREATE INDEX "BookingBelongingPhoto_dogId_idx" ON "BookingBelongingPhoto"("dogId");

-- AddForeignKey
ALTER TABLE "BookingBelongingPhoto" ADD CONSTRAINT "BookingBelongingPhoto_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingBelongingPhoto" ADD CONSTRAINT "BookingBelongingPhoto_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
