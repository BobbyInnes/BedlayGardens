/**
 * Shared cancellation policy logic — used both when a cancellation is
 * actually processed (portal/bookings/actions.ts) and to preview the
 * outcome to the customer before they confirm (cancel-booking-button.tsx).
 * Keeping this in one place means the preview can never drift from what
 * actually gets refunded.
 */

export type CancellationPolicyTier = "free" | "deposit_forfeit" | "no_refund"

export function getCancellationTier(
  startDate: Date,
  freeDays: number,
  noRefundHours: number,
  now: Date = new Date()
): CancellationPolicyTier {
  const hoursUntilStart = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60)
  if (hoursUntilStart >= freeDays * 24) return "free"
  if (hoursUntilStart >= noRefundHours) return "deposit_forfeit"
  return "no_refund"
}

/**
 * What gets refunded under each tier, given what's actually been paid so
 * far, split by DEPOSIT vs BALANCE. "deposit_forfeit" only refunds the
 * balance portion — so a booking paid entirely as a single DEPOSIT payment
 * (no separate balance, as with a low-value service like Meet & Greet)
 * refunds nothing in that tier, same as "no_refund".
 */
export function getExpectedRefundPence(
  tier: CancellationPolicyTier,
  depositPaidPence: number,
  balancePaidPence: number
): number {
  if (tier === "free") return depositPaidPence + balancePaidPence
  if (tier === "deposit_forfeit") return balancePaidPence
  return 0
}
