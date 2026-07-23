-- CreateEnum
CREATE TYPE "DaycareDuration" AS ENUM ('FULL_DAY', 'HALF_DAY');

-- CreateEnum
CREATE TYPE "DaycareHalfDaySlot" AS ENUM ('AM', 'PM');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "daycareDuration" "DaycareDuration",
ADD COLUMN     "daycareHalfDaySlot" "DaycareHalfDaySlot";

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "halfDayPricePence" INTEGER;
