import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { TrialOutcomeForm } from "@/components/staff/trial-outcome-form"

export const metadata: Metadata = {
  title: "Meet & Greet Trials | Staff",
}

const OUTCOME_LABELS = {
  PASSED: "Passed",
  RETRY: "Needs another visit",
  NOT_SUITABLE: "Not suitable",
} as const

export default async function StaffTrialsPage() {
  const [pending, recent] = await Promise.all([
    prisma.trialVisit.findMany({
      where: { outcome: null },
      include: { dog: true, booking: { include: { customer: true } } },
      orderBy: { booking: { startDate: "asc" } },
    }),
    prisma.trialVisit.findMany({
      where: { outcome: { not: null } },
      include: { dog: true, booking: { include: { customer: true } } },
      orderBy: { completedAt: "desc" },
      take: 20,
    }),
  ])

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Meet & Greet Trials</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mark the outcome after a trial visit — first-time boarders can&rsquo;t book overnight
          boarding until their trial is passed.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Awaiting outcome</h2>
        {pending.length > 0 ? (
          <ul className="space-y-3">
            {pending.map((trial) => (
              <li key={trial.id} className="rounded-lg border border-border p-4 text-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-medium">
                    {trial.dog.name}{" "}
                    <span className="font-normal text-muted-foreground">
                      — {trial.booking.customer.name}
                    </span>
                  </p>
                  <span className="text-muted-foreground">
                    {trial.booking.startDate.toLocaleDateString("en-GB")}
                  </span>
                </div>
                <TrialOutcomeForm trialVisitId={trial.id} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No trial visits awaiting an outcome.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent outcomes</h2>
        {recent.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {recent.map((trial) => (
              <li key={trial.id} className="space-y-1 p-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">
                    {trial.dog.name}{" "}
                    <span className="font-normal text-muted-foreground">
                      — {trial.booking.customer.name}
                    </span>
                  </p>
                  <Badge variant={trial.outcome === "PASSED" ? "default" : "destructive"}>
                    {trial.outcome ? OUTCOME_LABELS[trial.outcome] : ""}
                  </Badge>
                </div>
                {trial.notes && <p className="text-muted-foreground">{trial.notes}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No completed trials yet.</p>
        )}
      </section>
    </div>
  )
}
