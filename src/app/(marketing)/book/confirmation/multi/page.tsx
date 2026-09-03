import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CheckCircle2, AlertTriangle } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { reconcilePendingBookingPayments } from "@/lib/payments"
import { Button } from "@/components/ui/button"
import { formatPence } from "@/lib/format"
import { PayButton } from "@/components/marketing/pay-button"
import { BatchPayButton } from "@/components/marketing/batch-pay-button"
import { AutoPortalRedirect } from "@/components/marketing/auto-portal-redirect"

export const metadata: Metadata = {
  title: "Bookings Confirmed",
}

export default async function MultiBookingConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; failed?: string }>
}) {
  const { ids = "", failed } = await searchParams
  const bookingIds = ids.split(",").filter(Boolean)
  const session = await auth()

  const bookingQuery = {
    where: { id: { in: bookingIds }, customerId: session?.user.id },
    include: { service: true, bookingDogs: { include: { dog: true } } },
    orderBy: { startDate: "asc" as const },
  }

  let bookings = await prisma.booking.findMany(bookingQuery)
  if (bookings.length === 0) notFound()

  // Fallback if the Stripe webhook hasn't updated a booking yet (e.g. the
  // customer just returned from Checkout): ask Stripe directly and reconcile.
  const stillPending = bookings.filter((b) => b.status === "PENDING_PAYMENT")
  if (stillPending.length > 0) {
    await Promise.all(stillPending.map((b) => reconcilePendingBookingPayments(b.id)))
    bookings = await prisma.booking.findMany(bookingQuery)
  }

  const totalPence = bookings.reduce((sum, b) => sum + b.totalPence, 0)
  const failedCount = Number(failed ?? "0")
  const pendingBookings = bookings.filter((b) => b.status === "PENDING_PAYMENT")
  const anyPendingPayment = pendingBookings.length > 0
  // One combined card for the whole batch rather than one per date — they
  // share the same service/dogs/duration, so only the date actually varies
  // per row. Status is shown as one line: uniform if every date agrees,
  // otherwise a short breakdown (e.g. a partial batch payment can leave a
  // mix of CONFIRMED and PENDING_PAYMENT).
  const statusLabel = bookings.every((b) => b.status === bookings[0].status)
    ? bookings[0].status.toLowerCase().replace(/_/g, " ")
    : Object.entries(
        bookings.reduce<Record<string, number>>((counts, b) => {
          counts[b.status] = (counts[b.status] ?? 0) + 1
          return counts
        }, {})
      )
        .map(([status, count]) => `${count} ${status.toLowerCase().replace(/_/g, " ")}`)
        .join(", ")
  // Pay-together only makes sense once there's more than one date still
  // owing (createBatchCheckoutSession requires at least two anyway) — a
  // single remaining date falls back to its own ordinary "Pay deposit"
  // button instead, below.
  const canPayTogether = stripe && pendingBookings.length >= 2
  const depositTotalPence = pendingBookings.reduce((sum, b) => sum + b.depositPence, 0)
  const remainingTotalPence = pendingBookings.reduce((sum, b) => sum + b.totalPence, 0)

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <div className="mb-8 text-center">
        <CheckCircle2 className="mx-auto size-12 text-primary" aria-hidden="true" />
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          {bookings.length} {bookings[0].service.name.toLowerCase()} booking
          {bookings.length === 1 ? "" : "s"} reserved
        </h1>
        <p className="mt-2 text-muted-foreground">
          We&rsquo;ve reserved {bookings.length === 1 ? "your booking" : "each of your bookings"}{" "}
          below.
        </p>
      </div>

      {failedCount > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
          <p>
            {failedCount} of your selected date{failedCount === 1 ? "" : "s"} couldn&rsquo;t be
            booked (most likely it filled up) and{" "}
            {failedCount === 1 ? "was skipped" : "were skipped"}. The rest are below.
          </p>
        </div>
      )}

      <div className="space-y-2 rounded-xl border border-border p-4 text-sm">
        <div className="flex justify-between gap-4">
          <span className="shrink-0 text-muted-foreground">Dates</span>
          <span className="font-medium">
            {bookings.map((b) => b.startDate.toLocaleDateString("en-GB")).join(", ")}
          </span>
        </div>
        {bookings[0].daycareDuration && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Duration</span>
            <span className="font-medium">
              {bookings[0].daycareDuration === "HALF_DAY"
                ? `Half Day${bookings[0].daycareHalfDaySlot ? ` (${bookings[0].daycareHalfDaySlot})` : ""}`
                : "Full Day"}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Dogs</span>
          <span className="font-medium">
            {bookings[0].bookingDogs.map((bd) => bd.dog.name).join(", ")}
          </span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Status</span>
          <span className="capitalize">{statusLabel}</span>
        </div>
        {anyPendingPayment && !stripe && (
          <p className="text-muted-foreground">
            Online payment isn&rsquo;t enabled yet — we&rsquo;ll be in touch to arrange payment.
          </p>
        )}
      </div>

      <div className="mt-6 flex justify-between border-t border-border pt-4 text-sm font-medium">
        <span>Total across all dates</span>
        <span>{formatPence(totalPence)}</span>
      </div>

      {canPayTogether && (
        <div className="mt-4 space-y-3">
          <BatchPayButton
            bookingIds={pendingBookings.map((b) => b.id)}
            type="DEPOSIT"
            label={`Pay deposit for all ${pendingBookings.length} dates — ${formatPence(depositTotalPence)}`}
          />
          {pendingBookings[0].service.paymentTiming === "DEPOSIT_THEN_BALANCE" && (
            <BatchPayButton
              bookingIds={pendingBookings.map((b) => b.id)}
              type="FULL"
              label={`Pay in full for all ${pendingBookings.length} dates — ${formatPence(remainingTotalPence)}`}
            />
          )}
        </div>
      )}

      {stripe && pendingBookings.length === 1 && (
        <div className="mt-4">
          <PayButton
            bookingId={pendingBookings[0].id}
            type="DEPOSIT"
            label={`Pay deposit — ${formatPence(pendingBookings[0].depositPence)}`}
          />
        </div>
      )}

      <Button variant="outline" className="mt-6 w-full" asChild>
        <Link href="/portal/bookings">View my bookings</Link>
      </Button>
      {!anyPendingPayment && <AutoPortalRedirect />}
    </div>
  )
}
