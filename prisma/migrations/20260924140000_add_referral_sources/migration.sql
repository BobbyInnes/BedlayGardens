-- CreateTable
CREATE TABLE "ReferralSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralSource_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "referralSourceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ReferralSource_name_key" ON "ReferralSource"("name");

-- CreateIndex
CREATE INDEX "User_referralSourceId_idx" ON "User"("referralSourceId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referralSourceId_fkey" FOREIGN KEY ("referralSourceId") REFERENCES "ReferralSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the initial dropdown options (editable afterwards under Admin -> Referral Sources)
INSERT INTO "ReferralSource" ("id", "name", "sortOrder") VALUES
    ('referral_search_engine', 'Search Engine', 1),
    ('referral_social_media', 'Social Media', 2),
    ('referral_word_of_mouth', 'Word of Mouth / Referral', 3),
    ('referral_advertisement', 'Advertisement', 4),
    ('referral_email_newsletter', 'Email Newsletter', 5),
    ('referral_blog_or_article', 'Blog or Article', 6),
    ('referral_podcast_or_video', 'Podcast or Video', 7),
    ('referral_event_or_trade_show', 'Event or Trade Show', 8),
    ('referral_other', 'Other', 9);
