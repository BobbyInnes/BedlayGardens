import { stripe } from "@/lib/stripe"
import { formatPence } from "@/lib/format"
import { BatchPayButton } from "@/components/marketing/batch-pay-button"
import { BookingDogTag } from "@/components/ui/booking-dog-tag"
import { bookingCardClasses } from "@/lib/booking-card-colors"
import { formatBookingNumber } from "@/lib/customer-dog-numbers"
import { BookingActions, VaccinationNotice, type BookingCardBooking } from "@/components/portal/booking-card"

// One combined card for a Day Care multi-date batch (Booking.batchId) —
// all dates share the same service/dogs, so only the date, status, and
// per-date actions actually vary. Mirrors the equivalent combined card on
// the booking-confirmation page (book/confirmation/multi), but with each
// date's own Cancel (and, once payable individually, Pay) kept per row
// rather than folded away, so a customer can still act on just one date.
export function BatchBookingCard({
  bookings,
  freeDays,
  noRefundHours,
}: {
  bookings: BookingCardBooking[]
  freeDays: number
  noRefundHours: number
}) {
  const first = bookings[0]
  const totalPence = bookings.reduce((sum, b) => sum + b.totalPence, 0)
  const pendingBookings = bookings.filter((b) => b.status === "PENDING_PAYMENT")
  // Batch "pay them all together" only applies while every date is still
  // unpaid (createBatchCheckoutSession requires that) and there's more than
  // one — see payment-actions.ts. Once that's true, each date's own
  // deposit/full buttons are hidden in favour of these combined ones.
  const canPayTogether = Boolean(stripe) && pendingBookings.length >= 2
  const depositTotalPence = pendingBookings.reduce((sum, b) => sum + b.depositPence, 0)
  const remainingTotalPence = pendingBookings.reduce((sum, b) => sum + b.totalPence, 0)

  const uniformStatus = bookings.every((b) => b.status === first.status) ? first.status : null

  return (
    <li
      className={`rounded-lg border p-4 text-sm ${bookingCardClasses(first.service.name, uniformStatus ?? "")}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-medium">
            {first.service.name} <BookingDogTag names={first.bookingDogs.map((bd) => bd.dog.name)} />
          </p>
          <p className="text-muted-foreground">{bookings.length} dates</p>
        </div>
        <div className="text-right">
          <p className="font-medium">{formatPence(totalPence)}</p>
          <p className="text-muted-foreground">
            {uniformStatus ? uniformStatus.toLowerCase().replace(/_/g, " ") : "mixed status"}
          </p>
        </div>
      </div>

      {canPayTogether && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
          <BatchPayButton
            bookingIds={pendingBookings.map((b) => b.id)}
            type="DEPOSIT"
            label={
              first.service.paymentTiming === "FULL_UPFRONT"
                ? `Pay for all ${pendingBookings.length} dates — ${formatPence(depositTotalPence)}`
                : `Pay deposit for all ${pendingBookings.length} dates — ${formatPence(depositTotalPence)}`
            }
            size="sm"
            fullWidth={false}
          />
          {first.service.paymentTiming === "DEPOSIT_THEN_BALANCE" && (
            <BatchPayButton
              bookingIds={pendingBookings.map((b) => b.id)}
              type="FULL"
              label={`Pay in full for all ${pendingBookings.length} dates — ${formatPence(remainingTotalPence)}`}
              size="sm"
              fullWidth={false}
            />
          )}
        </div>
      )}

      <ul className="mt-3 divide-y divide-border border-t border-border">
        {bookings.map((booking) => (
          <li key={booking.id} className="py-2 first:pt-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{booking.startDate.toLocaleDateString("en-GB")}</p>
                <p className="text-xs text-muted-foreground">{formatBookingNumber(booking.bookingNumber)}</p>
                {!uniformStatus && (
                  <p className="text-xs text-muted-foreground capitalize">
                    {booking.status.toLowerCase().replace(/_/g, " ")}
                  </p>
                )}
              </div>
              <BookingActions
                booking={booking}
                freeDays={freeDays}
                noRefundHours={noRefundHours}
                hideDeposit={canPayTogether}
              />
            </div>
            <VaccinationNotice booking={booking} />
          </li>
        ))}
      </ul>
    </li>
  )
}
