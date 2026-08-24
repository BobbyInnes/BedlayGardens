-- Sequential customer-facing booking reference (displayed as "Booking
-- 001"), same pattern as 20260802150000_add_customer_dog_numbers — added
-- nullable first so existing rows backfill in creation order, then locked
-- down to NOT NULL + UNIQUE with a sequence for future inserts.

ALTER TABLE "Booking" ADD COLUMN "bookingNumber" INTEGER;

WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY "createdAt", id) AS rn
  FROM "Booking"
)
UPDATE "Booking" SET "bookingNumber" = numbered.rn
FROM numbered
WHERE "Booking".id = numbered.id;

CREATE SEQUENCE "Booking_bookingNumber_seq" OWNED BY "Booking"."bookingNumber";
SELECT setval('"Booking_bookingNumber_seq"', COALESCE((SELECT MAX("bookingNumber") FROM "Booking"), 0));
ALTER TABLE "Booking" ALTER COLUMN "bookingNumber" SET DEFAULT nextval('"Booking_bookingNumber_seq"');
ALTER TABLE "Booking" ALTER COLUMN "bookingNumber" SET NOT NULL;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_bookingNumber_key" UNIQUE ("bookingNumber");
