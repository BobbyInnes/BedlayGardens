import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { expireStaleOffers } from "@/lib/waitlist"
import { WaitlistRow } from "@/components/admin/waitlist-row"
import { offerToNextInLine } from "@/app/admin/waitlist/actions"
import { fullName, formatPence } from "@/lib/format"
import { formatBookingNumber } from "@/lib/customer-dog-numbers"
import { BookingDogTag } from "@/components/ui/booking-dog-tag"

export const metadata: Metadata = {
  title: "Waitlist | Admin",
}

export default async function AdminWaitlistPage() {
  await expireStaleOffers()

  const [entries, actionNeededBookings] = await Promise.all([
    prisma.waitlistEntry.findMany({
      where: { status: { in: ["WAITING", "OFFERED"] } },
      orderBy: { createdAt: "asc" },
      include: { service: true, dog: true, customer: true },
    }),
    // Mirrors the "Action needed" card on the customer's own portal waitlist
    // (/portal/waitlist) — shown here too so admin can keep an eye on
    // bookings at risk of auto-cancelling for a missing certificate.
    prisma.booking.findMany({
      where: { status: "PENDING_VACCINATION" },
      orderBy: { startDate: "asc" },
      include: { service: true, customer: true, bookingDogs: { include: { dog: true } } },
    }),
  ])

  const groups = new Map<
    string,
    { serviceId: string; serviceName: string; date: Date; endDate: Date | null; entries: typeof entries }
  >()
  for (const entry of entries) {
    const key = `${entry.serviceId}:${entry.date.toISOString()}:${entry.endDate?.toISOString() ?? ""}`
    if (!groups.has(key)) {
      groups.set(key, {
        serviceId: entry.serviceId,
        serviceName: entry.service.name,
        date: entry.date,
        endDate: entry.endDate,
        entries: [],
      })
    }
    groups.get(key)!.entries.push(entry)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Waitlist</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Grouped by service and date, in the order customers joined. When a space opens up, it&rsquo;s
          automatically offered to whoever is first in line.
        </p>
      </div>

      {actionNeededBookings.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">
            Bookings needing action ({actionNeededBookings.length})
          </h2>
          <ul className="space-y-3">
            {actionNeededBookings.map((booking) => (
              <li key={booking.id} className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {booking.service.name}{" "}
                      <BookingDogTag names={booking.bookingDogs.map((bd) => bd.dog.name)} />
                    </p>
                    <p className="text-muted-foreground">
                      {fullName(booking.customer)} — {booking.customer.email}
                    </p>
                    <p className="text-muted-foreground">
                      {booking.startDate.toLocaleDateString("en-GB")} —{" "}
                      {formatBookingNumber(booking.bookingNumber)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatPence(booking.totalPence)}</p>
                    <p className="text-muted-foreground">Pending Vaccination</p>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="font-medium text-destructive">Action needed — vaccine certificate required</p>
                  <p className="text-muted-foreground">
                    Upload all valid, in-date certificates for{" "}
                    {booking.bookingDogs.map((bd) => bd.dog.name).join(", ")} before{" "}
                    {booking.startDate.toLocaleDateString("en-GB")}, or this booking will be cancelled and any
                    deposit paid will not be refunded.
                  </p>
                  <Link
                    href={`/admin/bookings/${booking.id}`}
                    className="mt-1 inline-block font-medium underline"
                  >
                    View booking
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups.size > 0 ? (
        <div className="space-y-6">
          {[...groups.values()].map((group) => {
            const waiting = group.entries.filter((e) => e.status === "WAITING")
            return (
              <section
                key={`${group.serviceId}-${group.date.toISOString()}-${group.endDate?.toISOString() ?? ""}`}
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">
                    {group.serviceName} — {group.date.toLocaleDateString("en-GB")}
                    {group.endDate ? ` – ${group.endDate.toLocaleDateString("en-GB")}` : ""}
                  </h2>
                  {waiting.length > 0 && !group.entries.some((e) => e.status === "OFFERED") && (
                    <form action={offerToNextInLine.bind(null, group.serviceId, group.date, group.endDate)}>
                      <Button type="submit" size="sm" variant="outline">
                        Offer to next in line
                      </Button>
                    </form>
                  )}
                </div>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {group.entries.map((entry, i) => (
                    <WaitlistRow
                      key={entry.id}
                      entryId={entry.id}
                      position={i + 1}
                      customerName={fullName(entry.customer)}
                      dogName={entry.dog.name}
                      status={entry.status}
                      reason={entry.reason}
                      createdAt={entry.createdAt}
                      canMoveUp={entry.status === "WAITING" && waiting[0]?.id !== entry.id}
                      canMoveDown={
                        entry.status === "WAITING" && waiting[waiting.length - 1]?.id !== entry.id
                      }
                    />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      ) : (
        actionNeededBookings.length === 0 && (
          <p className="text-sm text-muted-foreground">No one is currently on a waitlist.</p>
        )
      )}
    </div>
  )
}
