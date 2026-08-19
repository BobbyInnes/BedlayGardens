import type { Metadata } from "next"
import Link from "next/link"
import { AlertTriangle, CalendarDays, PawPrint } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookingDogTag } from "@/components/ui/booking-dog-tag"
import { formatPence } from "@/lib/format"
import { bookingCardClasses } from "@/lib/booking-card-colors"
import { getAvailableCreditPence } from "@/lib/vouchers"

export const metadata: Metadata = {
  title: "Dashboard",
}

const EXPIRY_WARNING_DAYS = 30
const OPEN_BOOKING_STATUSES = ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"] as const
const CANCELLED_STATUSES = ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_ADMIN", "NO_SHOW"] as const

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

export default async function PortalDashboardPage() {
  const session = await auth()
  const userId = session!.user.id

  const [dogs, bookings, creditBalancePence] = await Promise.all([
    prisma.dog.findMany({
      where: { ownerId: userId },
      include: { vaccinationRecords: true },
    }),
    prisma.booking.findMany({
      where: { customerId: userId },
      orderBy: { startDate: "asc" },
      include: { service: true, payments: true, bookingDogs: { include: { dog: true } } },
    }),
    getAvailableCreditPence(userId),
  ])

  const now = new Date()
  const warningCutoff = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000)

  const vaccinationAlerts = dogs.flatMap((dog) =>
    dog.vaccinationRecords
      .filter((record) => record.expiryDate <= warningCutoff)
      .map((record) => ({
        dogName: dog.name,
        type: record.type,
        expiryDate: record.expiryDate,
        expired: record.expiryDate <= now,
      }))
  )

  const balanceDueBookings = bookings.filter(
    (booking) =>
      (OPEN_BOOKING_STATUSES as readonly string[]).includes(booking.status) &&
      booking.balanceDueDate &&
      booking.balanceDueDate <= warningCutoff
  )

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

  const upcomingBookings = bookings
    .filter((b) => (OPEN_BOOKING_STATUSES as readonly string[]).includes(b.status) && b.endDate >= now)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  const upcomingIds = new Set(upcomingBookings.map((b) => b.id))
  const pastBookings = bookings
    .filter((b) => !upcomingIds.has(b.id))
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back{session!.user.name ? `, ${session!.user.name}` : ""}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here&rsquo;s what&rsquo;s coming up for your dogs.
        </p>
      </div>

      {dogs.length === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>
            <strong>You haven&rsquo;t added a dog yet.</strong> You&rsquo;ll need a dog profile
            before you can book any service.{" "}
            <Link href="/portal/dogs/new" className="font-medium underline">
              Add a dog
            </Link>
          </p>
        </div>
      )}

      {(vaccinationAlerts.length > 0 || balanceDueBookings.length > 0) && (
        <div className="space-y-3">
          {vaccinationAlerts.map((alert, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
            >
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
              <p>
                <strong>{alert.dogName}</strong>&rsquo;s {alert.type} vaccination{" "}
                {alert.expired ? "has expired" : "is expiring soon"} (
                {alert.expiryDate.toLocaleDateString("en-GB")}).{" "}
                <Link href="/portal/vaccinations" className="font-medium underline">
                  Update records
                </Link>
              </p>
            </div>
          ))}
          {balanceDueBookings.map((booking) => (
            <div
              key={booking.id}
              className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm"
            >
              <CalendarDays className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <p>
                Balance due for your {booking.service.name}{" "}
                <BookingDogTag names={booking.bookingDogs.map((bd) => bd.dog.name)} /> booking on{" "}
                {booking.balanceDueDate?.toLocaleDateString("en-GB")}.{" "}
                <Link href="/portal/bookings" className="font-medium underline">
                  View booking
                </Link>
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My dogs</CardTitle>
          </CardHeader>
          <CardContent>
            {dogs.length > 0 ? (
              <ul className="space-y-3">
                {dogs.map((dog) => (
                  <li key={dog.id} className="flex items-center gap-2 text-sm">
                    <PawPrint className="size-4 text-primary" aria-hidden="true" />
                    {dog.name} <span className="text-muted-foreground">— {dog.breed}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Add a dog profile to get started.
                </p>
                <Button size="sm" asChild>
                  <Link href="/portal/dogs/new">Add a dog</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-2 rounded-lg border border-red-200 bg-red-100 p-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Bookings</p>
              <p className="font-semibold">{bookings.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total spent</p>
              <p className="font-semibold text-primary">{formatPence(totalSpentPence)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Account credit</p>
              <p className="font-semibold">{formatPence(creditBalancePence)}</p>
              {creditBalancePence > 0 && (
                <Link href="/portal/bookings" className="text-xs font-medium text-primary hover:underline">
                  Use credit
                </Link>
              )}
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
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">No upcoming bookings.</p>
                <Button size="sm" asChild>
                  <Link href="/book">Book a service</Link>
                </Button>
              </div>
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
