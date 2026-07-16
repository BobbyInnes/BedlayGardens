import type { BookingStatus, PaymentTiming } from "@/generated/prisma/client"

/**
 * Initial booking status and deposit for a service's payment timing.
 *
 * FULL_UPFRONT reuses the existing deposit machinery by setting the deposit
 * to the full total — the DEPOSIT checkout, webhook confirmation, manual
 * payment recording, and check-out outstanding-balance maths all keep
 * working unchanged, with a £0 balance. INVOICE_AFTER bookings are
 * confirmed without payment and invoiced at check-out (see lib/invoicing).
 */
export function paymentFieldsFor(
  timing: PaymentTiming,
  pricing: { totalPence: number; depositPence: number }
): { status: BookingStatus; depositPence: number } {
  switch (timing) {
    case "FULL_UPFRONT":
      return { status: "PENDING_PAYMENT", depositPence: pricing.totalPence }
    case "DEPOSIT_THEN_BALANCE":
      return { status: "PENDING_PAYMENT", depositPence: pricing.depositPence }
    case "INVOICE_AFTER":
      return { status: "CONFIRMED", depositPence: 0 }
  }
}
