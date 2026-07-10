-- CreateTable
CREATE TABLE "KennelOccupancy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kennelUnitId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "bookingId" TEXT NOT NULL,
    CONSTRAINT "KennelOccupancy_kennelUnitId_fkey" FOREIGN KEY ("kennelUnitId") REFERENCES "KennelUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KennelOccupancy_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "KennelOccupancy_bookingId_idx" ON "KennelOccupancy"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "KennelOccupancy_kennelUnitId_date_key" ON "KennelOccupancy"("kennelUnitId", "date");
