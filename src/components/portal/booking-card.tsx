import Link from "next/link"
import { stripe } from "@/lib/stripe"
import { getCancellationTier, getExpectedRefundPence } from "@/lib/cancellation-policy"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatPence } from "@/lib/format"
import { CancelBookingButton } from "@/components/portal/cancel-booking-button"
import { PayButton } from "@/components/marketing/pay-button"
import { RedeemCreditForm } from "@/components/portal/redeem-credit-form"
import { BookingDogTag } from "@/components/ui/booking-dog-tag"
import { TRIAL_OUTCOME_LABELS } from "@/lib/trial-outcome"
import { bookingCardClasses } from "@/lib/booking-card-colors"
import type { Booking, Service, Payment, TrialVisit, BookingDog, Dog } from "@/generated/prisma/client"

export const NON_CANCELLABLE_STATUSES = [
  "CHECKED_IN",
  "CHECKED_OUT",
  "COMPLETED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_ADMIN",
  "NO_SHOW",
]

export type BookingCardBooking = Booking & {
  service: Service
  payments: Payment[]
  trialVisits: (TrialVisit & { dog: Dog })[]
  bookingDogs: (BookingDog & { dog: Dog })[]
}

// One booking row on My Bookings and (for a PENDING_VACCINATION booking) on
// the Waitlist page — shared so "upload a certificate, then the booking
// moves off Waitlist" doesn't mean maintaining two copies of this markup.
export function BookingCard({
  booking,
  freeDays,
  noRefundHours,
}: {
  booking: BookingCardBooking
  freeDays: number
  noRefundHours: number
}) {
  const depositPaid = booking.payments.some((p) => p.type === "DEPOSIT" && p.status === "SUCCEEDED")
  const balancePaid = booking.payments.some((p) => p.type === "BALANCE" && p.status === "SUCCEEDED")
  const balancePence = booking.totalPence - booking.depositPence
  const depositPaidPence = booking.payments
    .filter((p) => p.type === "DEPOSIT" && p.status === "SUCCEEDED")
    .reduce((sum, p) => sum + p.amountPence, 0)
  const balancePaidPence = booking.payments
    .filter((p) => p.type === "BALANCE" && p.status === "SUCCEEDED")
    .reduce((sum, p) => sum + p.amountPence, 0)
  const cancellationTier = getCancellationTier(booking.startDate, freeDays, noRefundHours)
  const expectedRefundPence = getExpectedRefundPence(cancellationTier, depositPaidPence, balancePaidPence)
  const pendingInvoice = booking.payments.find((p) => p.type === "INVOICE" && p.status === "PENDING")

  const completedTrialVisits = booking.trialVisits.filter((tv) => tv.outcome)

  return (
    <li className={`rounded-lg border p-4 text-sm ${bookingCardClasses(booking.service.name)}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-medium">
            {booking.service.name} <BookingDogTag names={booking.bookingDogs.map((bd) => bd.dog.name)} />
          </p>
          <p className="text-muted-foreground">
            {booking.startDate.toLocaleDateString("en-GB")}
            {booking.endDate.getTime() !== booking.startDate.getTime()
              ? ` – ${booking.endDate.toLocaleDateString("en-GB")}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-medium">{formatPence(booking.totalPence)}</p>
            <p className="text-muted-foreground capitalize">
              {booking.status.toLowerCase().replace(/_/g, " ")}
            </p>
          </div>
          {booking.status === "PENDING_PAYMENT" && !depositPaid && (
            <>
              {stripe && (
                <PayButton
                  bookingId={booking.id}
                  type="DEPOSIT"
                  label={booking.service.paymentTiming === "FULL_UPFRONT" ? "Pay now" : "Pay deposit"}
                  size="sm"
                  fullWidth={false}
                />
              )}
              {stripe && booking.service.paymentTiming === "DEPOSIT_THEN_BALANCE" && (
                <PayButton
                  bookingId={booking.id}
                  type="FULL"
                  label={`Pay in full — ${formatPence(booking.totalPence)}`}
                  size="sm"
                  fullWidth={false}
                />
              )}
              <RedeemCreditForm
                bookingId={booking.id}
                type="DEPOSIT"
                depositPence={booking.depositPence}
                totalPence={booking.totalPence}
              />
            </>
          )}
          {booking.status === "CONFIRMED" &&
            booking.service.paymentTiming !== "INVOICE_AFTER" &&
            !balancePaid &&
            balancePence > 0 && (
            <>
              {stripe && (
                <PayButton bookingId={booking.id} type="BALANCE" label="Pay balance" size="sm" fullWidth={false} />
              )}
              <RedeemCreditForm bookingId={booking.id} type="BALANCE" />
            </>
          )}
          {pendingInvoice?.hostedInvoiceUrl && (
            <Button size="sm" asChild>
              <a href={pendingInvoice.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer">
                Pay invoice — {formatPence(pendingInvoice.amountPence)}
              </a>
            </Button>
          )}
          {!NON_CANCELLABLE_STATUSES.includes(booking.status) && (
            <CancelBookingButton
              bookingId={booking.id}
              paidPence={depositPaidPence + balancePaidPence}
              expectedRefundPence={expectedRefundPence}
            />
          )}
        </div>
      </div>

      {booking.status === "PENDING_VACCINATION" && (
        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p className="font-medium text-destructive">Action needed — vaccine certificate required</p>
          <p className="mt-1 text-muted-foreground">
            Upload all valid, in-date certificates for{" "}
            {booking.bookingDogs.map((bd) => bd.dog.name).join(", ")} before{" "}
            {booking.startDate.toLocaleDateString("en-GB")}, or this booking will be cancelled and any deposit
            paid will not be refunded.
          </p>
          <Link href="/portal/vaccinations" className="mt-2 inline-block font-medium text-primary hover:underline">
            Upload a certificate
          </Link>
        </div>
      )}

      {completedTrialVisits.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {completedTrialVisits.map((tv) => (
            <div key={tv.id} className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{tv.dog.name}</p>
                {tv.notes && <p className="text-muted-foreground">{tv.notes}</p>}
              </div>
              <Badge variant={tv.outcome === "PASSED" ? "default" : "destructive"}>
                {TRIAL_OUTCOME_LABELS[tv.outcome!]}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </li>
  )
}
