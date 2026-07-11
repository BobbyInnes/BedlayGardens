import type { Metadata } from "next"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { expireStaleOffers } from "@/lib/waitlist"
import { WaitlistEntryActions } from "@/components/portal/waitlist-entry-actions"

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

  const entries = await prisma.waitlistEntry.findMany({
    where: { customerId: session!.user.id },
    orderBy: { createdAt: "desc" },
    include: { service: true, dog: true },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Waitlist</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          When a date you wanted was full, you can join the waitlist from that service&rsquo;s booking
          page — we&rsquo;ll email you the moment a space opens up.
        </p>
      </div>

      {entries.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-medium">
                  {entry.service.name} — {entry.dog.name}
                </p>
                <p className="text-muted-foreground">{entry.date.toLocaleDateString("en-GB")}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={entry.status === "OFFERED" ? "default" : "secondary"}>
                  {STATUS_LABELS[entry.status]}
                </Badge>
                {(entry.status === "WAITING" || entry.status === "OFFERED") && (
                  <WaitlistEntryActions entryId={entry.id} offered={entry.status === "OFFERED"} />
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">You&rsquo;re not on any waitlists right now.</p>
      )}
    </div>
  )
}
