import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { formatPence } from "@/lib/format"
import { ProfileForm } from "@/components/portal/profile-form"
import { PasswordForm } from "@/components/portal/password-form"
import { DeleteAccountDialog } from "@/components/portal/delete-account-dialog"
import { BillingPortalButton } from "@/components/portal/billing-portal-button"
import { NotificationPreferenceForm } from "@/components/portal/notification-preference-form"
import { AbandonedBookingOptOut } from "@/components/portal/abandoned-booking-optout"
import { BookingDogTag } from "@/components/ui/booking-dog-tag"
import { bookingCardClasses } from "@/lib/booking-card-colors"

const OPEN_BOOKING_STATUSES = ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"] as const
const CANCELLED_STATUSES = ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_ADMIN", "NO_SHOW"] as const

function parsePerType(perType: string | null | undefined): Record<string, string> {
  try {
    return JSON.parse(perType ?? "{}")
  } catch {
    return {}
  }
}

export const metadata: Metadata = {
  title: "Account",
}

function BookingRow({
  booking,
}: {
  booking: {
    id: string
    startDate: Date
    endDate: Date
    status: string
    totalPence: number
    service: { name: string }
    bookingDogs: { dog: { name: string } }[]
  }
}) {
  return (
    <li className={`rounded-lg border p-3 text-sm ${bookingCardClasses(booking.service.name)}`}>
      <p className="font-medium">
        {booking.service.name} <BookingDogTag names={booking.bookingDogs.map((bd) => bd.dog.name)} />
      </p>
      <p className="text-muted-foreground">
        {booking.startDate.toLocaleDateString("en-GB")}
        {booking.endDate.getTime() !== booking.startDate.getTime()
          ? ` – ${booking.endDate.toLocaleDateString("en-GB")}`
          : ""}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <span>{formatPence(booking.totalPence)}</span>
        <Badge variant="outline">{booking.status.toLowerCase().replace(/_/g, " ")}</Badge>
      </div>
    </li>
  )
}

export default async function AccountPage() {
  const session = await auth()
  const [user, notificationPreference, bookings] = await Promise.all([
    prisma.user.findUnique({ where: { id: session!.user.id } }),
    prisma.notificationPreference.findUnique({ where: { customerId: session!.user.id } }),
    prisma.booking.findMany({
      where: { customerId: session!.user.id },
      orderBy: { startDate: "desc" },
      include: { service: true, payments: true, bookingDogs: { include: { dog: true } } },
    }),
  ])
  const abandonedBookingOptedOut = parsePerType(notificationPreference?.perType).ABANDONED_BOOKING_REMINDER === "off"

  const totalSpentPence = bookings.reduce((sum, booking) => {
    const bookingPayments = booking.payments.reduce((paymentSum, payment) => {
      if (payment.status !== "SUCCEEDED") return paymentSum
      return payment.type === "REFUND" ? paymentSum - payment.amountPence : paymentSum + payment.amountPence
    }, 0)
    return sum + bookingPayments
  }, 0)

  const outstandingPence = bookings.reduce((sum, booking) => {
    if ((CANCELLED_STATUSES as readonly string[]).includes(booking.status) || booking.status === "DRAFT") {
      return sum
    }
    const paidPence = booking.payments
      .filter((p) => p.status === "SUCCEEDED" && p.type !== "REFUND")
      .reduce((s, p) => s + p.amountPence, 0)
    return sum + Math.max(0, booking.totalPence - paidPence)
  }, 0)

  const now = new Date()
  const upcomingBookings = bookings
    .filter((b) => (OPEN_BOOKING_STATUSES as readonly string[]).includes(b.status) && b.endDate >= now)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  const upcomingIds = new Set(upcomingBookings.map((b) => b.id))
  const pastBookings = bookings.filter((b) => !upcomingIds.has(b.id))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="min-w-0 space-y-6">
          <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-100 p-4">
            <h2 className="text-lg font-semibold">Contact details</h2>
            <ProfileForm
              name={user?.name ?? ""}
              phone={user?.phone ?? ""}
              workPhone={user?.workPhone ?? ""}
              addressLine1={user?.addressLine1 ?? ""}
              addressLine2={user?.addressLine2 ?? ""}
              addressCity={user?.addressCity ?? ""}
              addressPostcode={user?.addressPostcode ?? ""}
            />
          </section>

          <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-100 p-4">
            <div>
              <h2 className="text-lg font-semibold">Notifications</h2>
              <p className="text-sm text-muted-foreground">
                How we contact you for pickup/drop-off updates, balance reminders, check-in reminders,
                and waitlist offers. SMS requires a phone number on file.
              </p>
            </div>
            <NotificationPreferenceForm channel={notificationPreference?.channel ?? "EMAIL"} />
            <AbandonedBookingOptOut initialOptedOut={abandonedBookingOptedOut} />
          </section>

          {user?.passwordHash && (
            <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-100 p-4">
              <h2 className="text-lg font-semibold">Password</h2>
              <PasswordForm />
            </section>
          )}

          <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-100 p-4">
            <div>
              <h2 className="text-lg font-semibold">Billing</h2>
              <p className="text-sm text-muted-foreground">
                View saved cards and payment history via Stripe.
              </p>
            </div>
            <BillingPortalButton />
          </section>

          <section className="space-y-4 rounded-lg border border-destructive/30 p-4">
            <div>
              <h2 className="text-lg font-semibold">Delete account</h2>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and personal data.
              </p>
            </div>
            <DeleteAccountDialog />
          </section>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-2 rounded-lg border border-red-200 bg-red-100 p-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Bookings</p>
              <p className="font-semibold">{bookings.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total spent</p>
              <p className="font-semibold text-primary">{formatPence(totalSpentPence)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className={`font-semibold ${outstandingPence > 0 ? "text-destructive" : ""}`}>
                {formatPence(outstandingPence)}
              </p>
            </div>
          </div>

          <section className="space-y-2 rounded-lg border border-blue-200 bg-blue-100 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Next {upcomingBookings.length} booking{upcomingBookings.length === 1 ? "" : "s"}
              </h2>
              <Link href="/portal/bookings" className="text-xs font-medium text-primary hover:underline">
                View all
              </Link>
            </div>
            {upcomingBookings.length > 0 ? (
              <ul className="space-y-2">
                {upcomingBookings.map((booking) => (
                  <BookingRow key={booking.id} booking={booking} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming bookings.</p>
            )}
          </section>

          {pastBookings.length > 0 && (
            <details className="rounded-lg border border-blue-200 bg-blue-100 p-4">
              <summary className="cursor-pointer text-sm font-semibold">
                Previous {pastBookings.length} booking{pastBookings.length === 1 ? "" : "s"}
              </summary>
              <ul className="mt-3 space-y-2">
                {pastBookings.map((booking) => (
                  <BookingRow key={booking.id} booking={booking} />
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}
