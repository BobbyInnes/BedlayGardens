import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { Button } from "@/components/ui/button"
import { formatPence } from "@/lib/format"
import { PayButton } from "@/components/marketing/pay-button"

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

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      service: true,
      kennelUnit: true,
      bookingDogs: { include: { dog: true } },
      bookingAddons: { include: { addon: true } },
    },
  })

  if (!booking || booking.customerId !== session?.user.id) {
    notFound()
  }

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
        <div className="flex justify-between">
          <span className="text-muted-foreground">Dogs</span>
          <span className="font-medium">
            {booking.bookingDogs.map((bd) => bd.dog.name).join(", ")}
          </span>
        </div>
        {booking.kennelUnit && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Kennel</span>
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
      ) : booking.service.paymentTiming === "INVOICE_AFTER" && booking.status === "CONFIRMED" ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Your booking is confirmed — nothing to pay now. We&rsquo;ll email you an invoice
          after the service.
        </p>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          You can view or cancel this booking any time from your account.
        </p>
      )}

      <Button variant="outline" className="mt-3 w-full" asChild>
        <Link href="/portal/bookings">View my bookings</Link>
      </Button>
    </div>
  )
}
