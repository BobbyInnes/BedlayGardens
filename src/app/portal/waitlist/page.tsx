import type { Metadata } from "next"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getSetting } from "@/lib/settings"
import { Badge } from "@/components/ui/badge"
import { expireStaleOffers } from "@/lib/waitlist"
import { WaitlistEntryActions } from "@/components/portal/waitlist-entry-actions"
import { BookingCard } from "@/components/portal/booking-card"

export const metadata: Metadata = {
  title: "Waitlist",
}

const STATUS_LABELS = {
  WAITING: "Waiting",
  OFFERED: "Space offered — claim now",
  CLAIMED: "Claimed",
  EXPIRED: "Offer expired",
} as const

export default async function PortalWaitlistPage() {
  const session = await auth()
  await expireStaleOffers()

  const [entries, actionNeededBookings, freeDays, noRefundHours] = await Promise.all([
    prisma.waitlistEntry.findMany({
      where: { customerId: session!.user.id },
      orderBy: { createdAt: "desc" },
      include: { service: true, dog: true },
    }),
    // Bookings that need something from the customer (currently: a missing
    // vaccine certificate) live here instead of on My Bookings, so they
    // don't get lost among bookings that don't need any attention — see
    // /portal/bookings, which excludes PENDING_VACCINATION for the same
    // reason. Once resolved (certificate uploaded & the gate clears) the
    // booking flips to CONFIRMED and moves back there on its own.
    prisma.booking.findMany({
      where: { customerId: session!.user.id, status: "PENDING_VACCINATION" },
      orderBy: { createdAt: "desc" },
      include: {
        service: true,
        payments: true,
        trialVisits: { include: { dog: true } },
        bookingDogs: { include: { dog: true } },
      },
    }),
    getSetting("cancellation_free_days", "14"),
    getSetting("cancellation_no_refund_hours", "48"),
  ])

  // One combined, chronologically-mixed list — a booking needing action and
  // a waitlist spot are both "something in line, waiting on you or on us",
  // so they read as one list rather than two disconnected sections.
  type ListItem =
    | { kind: "action"; sortDate: Date; booking: (typeof actionNeededBookings)[number] }
    | { kind: "waitlist"; sortDate: Date; entry: (typeof entries)[number] }
  const items: ListItem[] = [
    ...actionNeededBookings.map(
      (booking): ListItem => ({ kind: "action", sortDate: booking.createdAt, booking })
    ),
    ...entries.map((entry): ListItem => ({ kind: "waitlist", sortDate: entry.createdAt, entry })),
  ].sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime())

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Waitlist</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bookings that need something from you (like a vaccine certificate) and any waitlist spots
          you&rsquo;re waiting on both show here — we&rsquo;ll email you the moment a waitlist space opens up.
        </p>
      </div>

      {items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((item) =>
            item.kind === "action" ? (
              <BookingCard
                key={`booking-${item.booking.id}`}
                booking={item.booking}
                freeDays={Number(freeDays)}
                noRefundHours={Number(noRefundHours)}
              />
            ) : (
              <li
                key={`entry-${item.entry.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {item.entry.service.name} — {item.entry.dog.name}
                  </p>
                  <p className="text-muted-foreground">
                    {item.entry.date.toLocaleDateString("en-GB")}
                    {item.entry.endDate ? ` – ${item.entry.endDate.toLocaleDateString("en-GB")}` : ""}
                  </p>
                  {item.entry.reason && <p className="mt-1 text-muted-foreground">{item.entry.reason}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Added {item.entry.createdAt.toLocaleDateString("en-GB")} at{" "}
                    {item.entry.createdAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={item.entry.status === "OFFERED" ? "default" : "secondary"}>
                    {STATUS_LABELS[item.entry.status]}
                  </Badge>
                  {(item.entry.status === "WAITING" || item.entry.status === "OFFERED") && (
                    <WaitlistEntryActions entryId={item.entry.id} offered={item.entry.status === "OFFERED"} />
                  )}
                </div>
              </li>
            )
          )}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing here right now.</p>
      )}
    </div>
  )
}
