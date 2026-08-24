-- CreateTable
CREATE TABLE "DogMedication" (
    "id" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" TEXT,
    "am" BOOLEAN NOT NULL DEFAULT false,
    "pm" BOOLEAN NOT NULL DEFAULT false,
    "specificTime" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DogMedication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DogMedication_dogId_idx" ON "DogMedication"("dogId");

-- AddForeignKey
ALTER TABLE "DogMedication" ADD CONSTRAINT "DogMedication_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
