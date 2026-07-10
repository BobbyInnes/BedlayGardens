-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "bookingId" TEXT,
    "vaccinationRecordId" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "EmailLog_type_bookingId_idx" ON "EmailLog"("type", "bookingId");

-- CreateIndex
CREATE INDEX "EmailLog_type_vaccinationRecordId_idx" ON "EmailLog"("type", "vaccinationRecordId");
