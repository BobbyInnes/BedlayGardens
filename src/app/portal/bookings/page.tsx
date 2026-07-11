import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { Button } from "@/components/ui/button"
import { formatPence } from "@/lib/format"
import { CancelBookingButton } from "@/components/portal/cancel-booking-button"
import { PayButton } from "@/components/marketing/pay-button"
import { RedeemCreditForm } from "@/components/portal/redeem-credit-form"

export const metadata: Metadata = {
  title: "Bookings",
}

const NON_CANCELLABLE_STATUSES = [
  "CHECKED_IN",
  "CHECKED_OUT",
  "COMPLETED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_ADMIN",
  "NO_SHOW",
]

export default async function PortalBookingsPage() {
  const session = await auth()
  const bookings = await prisma.booking.findMany({
    where: { customerId: session!.user.id },
    orderBy: { startDate: "desc" },
    include: { service: true, payments: true },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
        <Button size="sm" asChild>
          <Link href="/book">Book a stay</Link>
        </Button>
      </div>

      {bookings.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {bookings.map((booking) => {
            const depositPaid = booking.payments.some(
              (p) => p.type === "DEPOSIT" && p.status === "SUCCEEDED"
            )
            const balancePaid = booking.payments.some(
              (p) => p.type === "BALANCE" && p.status === "SUCCEEDED"
            )
            const balancePence = booking.totalPence - booking.depositPence

            return (
              <li key={booking.id} className="flex flex-wrap items-center justify-between gap-4 p-4 text-sm">
                <div>
                  <p className="font-medium">{booking.service.name}</p>
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
                          label="Pay deposit"
                          size="sm"
                          fullWidth={false}
                        />
                      )}
                      <RedeemCreditForm bookingId={booking.id} type="DEPOSIT" />
                    </>
                  )}
                  {booking.status === "CONFIRMED" && !balancePaid && balancePence > 0 && (
                    <>
                      {stripe && (
                        <PayButton
                          bookingId={booking.id}
                          type="BALANCE"
                          label="Pay balance"
                          size="sm"
                          fullWidth={false}
                        />
                      )}
                      <RedeemCreditForm bookingId={booking.id} type="BALANCE" />
                    </>
                  )}
                  {!NON_CANCELLABLE_STATUSES.includes(booking.status) && (
                    <CancelBookingButton bookingId={booking.id} />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          You don&rsquo;t have any bookings yet.{" "}
          <Link href="/book" className="font-medium text-primary hover:underline">
            Book a stay
          </Link>
          .
        </p>
      )}
    </div>
  )
}
