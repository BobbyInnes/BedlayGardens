import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { getSetting } from "@/lib/settings"
import { startOfDay } from "@/lib/dates"
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button"
import { ServiceAreaForm } from "@/components/admin/service-area-form"
import { deleteVanRun } from "@/app/admin/van-runs/actions"

export const metadata: Metadata = {
  title: "Van Runs | Admin",
}

export default async function AdminVanRunsPage() {
  const [runs, postcodes] = await Promise.all([
    prisma.vanRun.findMany({
      where: { date: { gte: startOfDay(new Date()) } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      include: { staff: true, stops: true },
    }),
    getSetting("dog_walking_service_postcodes", ""),
  ])

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Van Runs</h1>
        <Button size="sm" asChild>
          <Link href="/admin/van-runs/new">Create van run</Link>
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Service area</h2>
        <ServiceAreaForm postcodes={postcodes} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Upcoming runs</h2>
        {runs.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {runs.map((run) => (
              <li key={run.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-medium">
                    {run.name} — {run.date.toLocaleDateString("en-GB")} at {run.startTime}
                  </p>
                  <p className="text-muted-foreground">
                    {run.stops.length}/{run.maxDogs} dogs
                    {run.staff ? ` · ${run.staff.name}` : " · Unassigned"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/van-runs/${run.id}`}>Edit</Link>
                  </Button>
                  {run.stops.length === 0 ? (
                    <ConfirmDeleteButton
                      onConfirm={deleteVanRun.bind(null, run.id)}
                      title="Delete this van run?"
                      description="This cannot be undone."
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">In use</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No upcoming van runs scheduled.</p>
        )}
      </section>
    </div>
  )
}
