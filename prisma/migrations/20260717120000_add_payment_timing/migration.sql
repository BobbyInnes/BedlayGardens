-- CreateEnum
CREATE TYPE "PaymentTiming" AS ENUM ('FULL_UPFRONT', 'DEPOSIT_THEN_BALANCE', 'INVOICE_AFTER');

-- AlterEnum
ALTER TYPE "PaymentType" ADD VALUE 'INVOICE';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "hostedInvoiceUrl" TEXT,
ADD COLUMN     "stripeInvoiceId" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "paymentTiming" "PaymentTiming" NOT NULL DEFAULT 'DEPOSIT_THEN_BALANCE';

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeInvoiceId_key" ON "Payment"("stripeInvoiceId");
