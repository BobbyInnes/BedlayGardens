-- Sequential customer/dog ID numbers (displayed as CUST-00001 / DOG-00001).
-- Added as nullable first so existing rows can be backfilled in signup/
-- creation order rather than arbitrary physical row order, then locked
-- down to NOT NULL + UNIQUE with a sequence for future inserts.

-- User.customerNumber
ALTER TABLE "User" ADD COLUMN "customerNumber" INTEGER;

WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY "createdAt", id) AS rn
  FROM "User"
)
UPDATE "User" SET "customerNumber" = numbered.rn
FROM numbered
WHERE "User".id = numbered.id;

CREATE SEQUENCE "User_customerNumber_seq" OWNED BY "User"."customerNumber";
SELECT setval('"User_customerNumber_seq"', COALESCE((SELECT MAX("customerNumber") FROM "User"), 0));
ALTER TABLE "User" ALTER COLUMN "customerNumber" SET DEFAULT nextval('"User_customerNumber_seq"');
ALTER TABLE "User" ALTER COLUMN "customerNumber" SET NOT NULL;
ALTER TABLE "User" ADD CONSTRAINT "User_customerNumber_key" UNIQUE ("customerNumber");

-- Dog.dogNumber
ALTER TABLE "Dog" ADD COLUMN "dogNumber" INTEGER;

WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY "createdAt", id) AS rn
  FROM "Dog"
)
UPDATE "Dog" SET "dogNumber" = numbered.rn
FROM numbered
WHERE "Dog".id = numbered.id;

CREATE SEQUENCE "Dog_dogNumber_seq" OWNED BY "Dog"."dogNumber";
SELECT setval('"Dog_dogNumber_seq"', COALESCE((SELECT MAX("dogNumber") FROM "Dog"), 0));
ALTER TABLE "Dog" ALTER COLUMN "dogNumber" SET DEFAULT nextval('"Dog_dogNumber_seq"');
ALTER TABLE "Dog" ALTER COLUMN "dogNumber" SET NOT NULL;
ALTER TABLE "Dog" ADD CONSTRAINT "Dog_dogNumber_key" UNIQUE ("dogNumber");
