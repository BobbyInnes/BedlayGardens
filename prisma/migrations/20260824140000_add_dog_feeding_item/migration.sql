-- CreateTable
CREATE TABLE "DogFeedingItem" (
    "id" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "amount" TEXT,
    "am" BOOLEAN NOT NULL DEFAULT false,
    "pm" BOOLEAN NOT NULL DEFAULT false,
    "specificTime" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DogFeedingItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DogFeedingItem_dogId_idx" ON "DogFeedingItem"("dogId");

-- AddForeignKey
ALTER TABLE "DogFeedingItem" ADD CONSTRAINT "DogFeedingItem_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
