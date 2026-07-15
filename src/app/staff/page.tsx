import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { today, tomorrow } from "@/lib/staff-dates"
import { DogFlagBadges } from "@/components/staff/dog-flag-badges"
import type { DogFlagType } from "@/generated/prisma/client"

function allFlags(bookingDogs: { dog: { flags: { type: DogFlagType; notes: string | null }[] } }[]) {
  return bookingDogs.flatMap((bd) => bd.dog.flags)
}

export const metadata: Metadata = {
  title: "Today | Staff",
}

const ON_SITE_SERVICE_SLUGS = ["overnight-boarding", "daycare"]

export default async function StaffTodayPage() {
  const start = today()
  const end = tomorrow()

  const [arrivals, departures, inHouse] = await Promise.all([
    prisma.booking.findMany({
      where: {
        startDate: { gte: start, lt: end },
        status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
        service: { slug: { in: ON_SITE_SERVICE_SLUGS } },
      },
      include: {
        customer: true,
        service: true,
        bookingDogs: { include: { dog: { include: { flags: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.booking.findMany({
      where: {
        endDate: { gte: start, lt: end },
        status: "CHECKED_IN",
        service: { slug: { in: ON_SITE_SERVICE_SLUGS } },
      },
      include: {
        customer: true,
        service: true,
        bookingDogs: { include: { dog: { include: { flags: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.booking.findMany({
      where: {
        status: "CHECKED_IN",
        service: { slug: { in: ON_SITE_SERVICE_SLUGS } },
      },
      include: {
        customer: true,
        service: true,
        kennelUnit: true,
        bookingDogs: { include: { dog: { include: { flags: true } } } },
      },
      orderBy: { startDate: "asc" },
    }),
  ])

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {start.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Arrivals ({arrivals.length})</h2>
        {arrivals.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {arrivals.map((booking) => (
              <li key={booking.id}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>{booking.bookingDogs.map((bd) => bd.dog.name).join(", ")}</span>
                      <Badge variant="secondary">{booking.service.name}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>{booking.customer.name}</p>
                    <DogFlagBadges flags={allFlags(booking.bookingDogs)} />
                    <Button size="sm" asChild>
                      <Link href={`/staff/bookings/${booking.id}/check-in`}>Check in</Link>
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No arrivals today.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Departures ({departures.length})</h2>
        {departures.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {departures.map((booking) => (
              <li key={booking.id}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>{booking.bookingDogs.map((bd) => bd.dog.name).join(", ")}</span>
                      <Badge variant="secondary">{booking.service.name}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>{booking.customer.name}</p>
                    <DogFlagBadges flags={allFlags(booking.bookingDogs)} />
                    <Button size="sm" asChild>
                      <Link href={`/staff/bookings/${booking.id}/check-out`}>Check out</Link>
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No departures today.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">In-house ({inHouse.length})</h2>
        {inHouse.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {inHouse.map((booking) => (
              <li key={booking.id} className="flex items-center justify-between gap-4 p-4 text-sm">
                <div className="space-y-1">
                  <p className="font-medium">
                    {booking.bookingDogs.map((bd) => bd.dog.name).join(", ")}
                  </p>
                  <p className="text-muted-foreground">
                    {booking.customer.name} — {booking.service.name}
                  </p>
                  <DogFlagBadges flags={allFlags(booking.bookingDogs)} />
                </div>
                <div className="text-right text-muted-foreground">
                  {booking.kennelUnit && <p>{booking.kennelUnit.name}</p>}
                  <p>Until {booking.endDate.toLocaleDateString("en-GB")}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No dogs currently in-house.</p>
        )}
      </section>
    </div>
  )
}
