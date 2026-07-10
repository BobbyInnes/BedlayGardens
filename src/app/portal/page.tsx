import type { Metadata } from "next"
import Link from "next/link"
import { AlertTriangle, CalendarDays, PawPrint } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Dashboard",
}

const EXPIRY_WARNING_DAYS = 30

export default async function PortalDashboardPage() {
  const session = await auth()
  const userId = session!.user.id

  const [dogs, bookings] = await Promise.all([
    prisma.dog.findMany({
      where: { ownerId: userId },
      include: { vaccinationRecords: true },
    }),
    prisma.booking.findMany({
      where: {
        customerId: userId,
        status: { in: ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"] },
      },
      orderBy: { startDate: "asc" },
      include: { service: true },
    }),
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
    (booking) => booking.balanceDueDate && booking.balanceDueDate <= warningCutoff
  )

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
                Balance due for your {booking.service.name} booking on{" "}
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
            <CardTitle className="text-base">Upcoming bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {bookings.length > 0 ? (
              <ul className="space-y-3">
                {bookings.map((booking) => (
                  <li key={booking.id} className="flex items-center justify-between text-sm">
                    <span>{booking.service.name}</span>
                    <span className="text-muted-foreground">
                      {booking.startDate.toLocaleDateString("en-GB")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">No upcoming bookings yet.</p>
                <Button size="sm" asChild>
                  <Link href="/book">Book a stay</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

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
      </div>
    </div>
  )
}
