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

      <div className="space-y-4">
        {bookings.map((booking) => (
          <div key={booking.id} className="space-y-2 rounded-xl border border-border p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{booking.startDate.toLocaleDateString("en-GB")}</span>
            </div>
            {booking.daycareDuration && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">
                  {booking.daycareDuration === "HALF_DAY"
                    ? `Half Day${booking.daycareHalfDaySlot ? ` (${booking.daycareHalfDaySlot})` : ""}`
                    : "Full Day"}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dogs</span>
              <span className="font-medium">
                {booking.bookingDogs.map((bd) => bd.dog.name).join(", ")}
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 font-medium">
              <span>Total</span>
              <span>{formatPence(booking.totalPence)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Status</span>
              <span className="capitalize">{booking.status.toLowerCase().replace(/_/g, " ")}</span>
            </div>
            {booking.status === "PENDING_PAYMENT" && stripe ? (
              <PayButton
                bookingId={booking.id}
                type="DEPOSIT"
                label={
                  booking.service.paymentTiming === "FULL_UPFRONT"
                    ? `Pay now — ${formatPence(booking.depositPence)}`
                    : `Pay deposit — ${formatPence(booking.depositPence)}`
                }
              />
            ) : booking.status === "PENDING_PAYMENT" ? (
              <p className="text-muted-foreground">
                Online payment isn&rsquo;t enabled yet — we&rsquo;ll be in touch to arrange payment.
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-between border-t border-border pt-4 text-sm font-medium">
        <span>Total across all dates</span>
        <span>{formatPence(totalPence)}</span>
      </div>

      <Button variant="outline" className="mt-6 w-full" asChild>
        <Link href="/portal/bookings">View my bookings</Link>
      </Button>
    </div>
  )
}
