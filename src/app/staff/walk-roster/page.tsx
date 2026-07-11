import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { today } from "@/lib/staff-dates"
import { DogFlagBadges } from "@/components/staff/dog-flag-badges"

export const metadata: Metadata = {
  title: "Walk Roster | Staff",
}

export default async function StaffWalkRosterPage() {
  const slots = await prisma.walkSlot.findMany({
    where: { date: today() },
    orderBy: { time: "asc" },
    include: {
      walkBookings: {
        include: { dog: { include: { flags: true } }, booking: { include: { customer: true } } },
      },
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Walk Roster</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {today().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {slots.length > 0 ? (
        <div className="space-y-6">
          {slots.map((slot) => (
            <section key={slot.id} className="space-y-2">
              <h2 className="font-semibold">
                {slot.time} ({slot.durationMin} min) — {slot.walkBookings.length}/{slot.maxDogs} dogs
              </h2>
              {slot.walkBookings.length > 0 ? (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {slot.walkBookings.map((wb) => (
                    <li key={wb.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{wb.dog.name}</span>
                        <DogFlagBadges flags={wb.dog.flags} />
                      </span>
                      <span className="text-muted-foreground">
                        {wb.booking?.customer.name ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No dogs booked for this session.</p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No forest walk sessions scheduled today.</p>
      )}
    </div>
  )
}
