import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { today } from "@/lib/staff-dates"
import { VanRunStopItem } from "@/components/staff/van-run-stop-item"

export const metadata: Metadata = {
  title: "Van Runs | Staff",
}

export default async function StaffVanRunsPage() {
  const runs = await prisma.vanRun.findMany({
    where: { date: today() },
    orderBy: { startTime: "asc" },
    include: {
      stops: { include: { dog: { include: { flags: true } } }, orderBy: { sortOrder: "asc" } },
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Van Runs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {today().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {runs.length > 0 ? (
        <div className="space-y-6">
          {runs.map((run) => (
            <section key={run.id} className="space-y-2">
              <h2 className="font-semibold">
                {run.name} — {run.startTime} ({run.stops.length}/{run.maxDogs} dogs)
              </h2>
              {run.stops.length > 0 ? (
                <ul className="space-y-2">
                  {run.stops.map((stop) => (
                    <VanRunStopItem
                      key={stop.id}
                      stopId={stop.id}
                      dogName={stop.dog.name}
                      pickupAddress={stop.pickupAddress}
                      accessNotes={stop.accessNotes}
                      status={stop.status}
                      flags={stop.dog.flags}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No dogs booked for this run.</p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No van runs scheduled today.</p>
      )}
    </div>
  )
}
