import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { expireStaleOffers } from "@/lib/waitlist"
import { WaitlistRow } from "@/components/admin/waitlist-row"
import { offerToNextInLine } from "@/app/admin/waitlist/actions"

export const metadata: Metadata = {
  title: "Waitlist | Admin",
}

export default async function AdminWaitlistPage() {
  await expireStaleOffers()

  const entries = await prisma.waitlistEntry.findMany({
    where: { status: { in: ["WAITING", "OFFERED"] } },
    orderBy: { createdAt: "asc" },
    include: { service: true, dog: true, customer: true },
  })

  const groups = new Map<
    string,
    { serviceId: string; serviceName: string; date: Date; entries: typeof entries }
  >()
  for (const entry of entries) {
    const key = `${entry.serviceId}:${entry.date.toISOString()}`
    if (!groups.has(key)) {
      groups.set(key, { serviceId: entry.serviceId, serviceName: entry.service.name, date: entry.date, entries: [] })
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

      {groups.size > 0 ? (
        <div className="space-y-6">
          {[...groups.values()].map((group) => {
            const waiting = group.entries.filter((e) => e.status === "WAITING")
            return (
              <section key={`${group.serviceId}-${group.date.toISOString()}`} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">
                    {group.serviceName} — {group.date.toLocaleDateString("en-GB")}
                  </h2>
                  {waiting.length > 0 && !group.entries.some((e) => e.status === "OFFERED") && (
                    <form action={offerToNextInLine.bind(null, group.serviceId, group.date)}>
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
                      customerName={entry.customer.name}
                      dogName={entry.dog.name}
                      status={entry.status}
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
        <p className="text-sm text-muted-foreground">No one is currently on a waitlist.</p>
      )}
    </div>
  )
}
