import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { reconcilePendingBookingPayments } from "@/lib/payments"
import { Button } from "@/components/ui/button"
import { formatPence } from "@/lib/format"
import { PayButton } from "@/components/marketing/pay-button"
import { AutoPortalRedirect } from "@/components/marketing/auto-portal-redirect"

export const metadata: Metadata = {
  title: "Booking Confirmed",
}

export default async function BookingConfirmationPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const { bookingId } = await params
  const session = await auth()

  const bookingQuery = {
    where: { id: bookingId },
    include: {
      service: true,
      kennelUnit: true,
      payments: true,
      bookingDogs: { include: { dog: true } },
      bookingAddons: { include: { addon: true } },
    },
  }

  let booking = await prisma.booking.findUnique(bookingQuery)

  if (!booking || booking.customerId !== session?.user.id) {
    notFound()
  }

  // Fallback if the Stripe webhook hasn't updated the payment yet (e.g. the
  // customer just returned from Checkout): ask Stripe directly and reconcile,
  // then re-read so the page shows the up-to-date status. Runs regardless of
  // booking.status — a BALANCE payment always lands on an already-CONFIRMED
  // booking (the deposit confirmed it earlier), so gating this on
  // PENDING_PAYMENT (as before) silently skipped the fallback for every
  // balance payment, leaving it stuck PENDING forever if the webhook never
  // arrived. reconcilePendingBookingPayments no-ops cheaply when there's
  // nothing PENDING, so it's safe to just always attempt it here.
  if (stripe) {
    await reconcilePendingBookingPayments(bookingId)
    booking = (await prisma.booking.findUnique(bookingQuery)) ?? booking
  }

  const balancePence = booking.totalPence - booking.depositPence
  const balancePaid = booking.payments.some((p) => p.type === "BALANCE" && p.status === "SUCCEEDED")
  // Distinguishes "just paid the deposit, balance isn't due yet" (the normal
  // path into CONFIRMED for every deposit-then-balance booking — no BALANCE
  // payment exists yet at all) from "came back from a balance Checkout that
  // didn't complete" (a PENDING/FAILED BALANCE payment already exists) — the
  // two need different copy so we don't tell someone their deposit "didn't
  // go through" when it's the balance that's merely not due yet.
  const balanceAttempted = booking.payments.some((p) => p.type === "BALANCE")
  const balanceStillDue =
    booking.status === "CONFIRMED" &&
    booking.service.paymentTiming === "DEPOSIT_THEN_BALANCE" &&
    !balancePaid &&
    balancePence > 0

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <div className="mb-8 text-center">
        <CheckCircle2 className="mx-auto size-12 text-primary" aria-hidden="true" />
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Booking reserved</h1>
        <p className="mt-2 text-muted-foreground">
          We&rsquo;ve reserved your {booking.service.name.toLowerCase()} booking.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-border p-6 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Service</span>
          <span className="font-medium">{booking.service.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Dates</span>
          <span className="font-medium">
            {booking.startDate.toLocaleDateString("en-GB")}
            {booking.endDate.getTime() !== booking.startDate.getTime()
              ? ` – ${booking.endDate.toLocaleDateString("en-GB")}`
              : ""}
          </span>
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
        {booking.kennelUnit && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Accommodation</span>
            <span className="font-medium">{booking.kennelUnit.name}</span>
          </div>
        )}
        {booking.bookingAddons.length > 0 && (
          <div className="space-y-1 border-t border-border pt-2">
            {booking.bookingAddons.map((ba) => (
              <div key={ba.id} className="flex justify-between text-muted-foreground">
                <span>{ba.addon.name}</span>
                <span>{formatPence(ba.pricePence)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-2 font-medium">
          <span>Total</span>
          <span>{formatPence(booking.totalPence)}</span>
        </div>
        {booking.service.paymentTiming === "DEPOSIT_THEN_BALANCE" && (
          <div className="flex justify-between text-muted-foreground">
            <span>Deposit</span>
            <span>{formatPence(booking.depositPence)}</span>
          </div>
        )}
        <div className="flex justify-between text-muted-foreground">
          <span>Status</span>
          <span className="capitalize">{booking.status.toLowerCase().replace(/_/g, " ")}</span>
        </div>
      </div>

      {booking.status === "PENDING_PAYMENT" && stripe ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            {booking.service.paymentTiming === "FULL_UPFRONT"
              ? "Pay now to confirm this booking."
              : "Pay your deposit now to confirm this booking. Your card is saved securely with Stripe so we can collect the balance automatically before check-in."}
          </p>
          <PayButton
            bookingId={booking.id}
            type="DEPOSIT"
            label={
              booking.service.paymentTiming === "FULL_UPFRONT"
                ? `Pay now — ${formatPence(booking.depositPence)}`
                : `Pay deposit — ${formatPence(booking.depositPence)}`
            }
          />
        </div>
      ) : booking.status === "PENDING_PAYMENT" ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Online payment isn&rsquo;t enabled yet — we&rsquo;ll be in touch to arrange payment.
        </p>
      ) : balanceStillDue && stripe ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            {balanceAttempted
              ? `That payment didn't go through — ${formatPence(balancePence)} is still due on this booking.`
              : `Your booking is confirmed. The remaining balance of ${formatPence(balancePence)} is due before your stay — we'll collect it automatically nearer the time, or you can pay it now.`}
          </p>
          <PayButton bookingId={booking.id} type="BALANCE" label={`Pay balance — ${formatPence(balancePence)}`} />
        </div>
      ) : booking.service.paymentTiming === "INVOICE_AFTER" && booking.status === "CONFIRMED" ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Your booking is confirmed — nothing to pay now. We&rsquo;ll email you an invoice
          after the service.
        </p>
      ) : booking.status === "PENDING_VACCINATION" ? (
        <div className="mt-6 space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">Action needed — vaccine certificate required</p>
          <p className="text-sm text-muted-foreground">
            {booking.bookingDogs.map((bd) => bd.dog.name).join(", ")} still need{" "}
            {booking.bookingDogs.length === 1 ? "s" : ""} a valid, in-date certificate before{" "}
            {booking.startDate.toLocaleDateString("en-GB")}, or this booking will be cancelled and any deposit
            paid will not be refunded.
          </p>
          <Button asChild>
            <Link href="/portal/vaccinations">Upload a certificate</Link>
          </Button>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          You can view or cancel this booking any time from your account.
        </p>
      )}

      <Button variant="outline" className="mt-3 w-full" asChild>
        <Link href="/portal/bookings">View my bookings</Link>
      </Button>
      {booking.status !== "PENDING_PAYMENT" && booking.status !== "PENDING_VACCINATION" && !balanceStillDue && (
        <AutoPortalRedirect />
      )}
    </div>
  )
}
