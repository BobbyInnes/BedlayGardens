import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { TrialOutcomeForm } from "@/components/staff/trial-outcome-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { Prisma } from "@/generated/prisma/client"
import { TRIAL_OUTCOME_LABELS } from "@/lib/trial-outcome"

export const metadata: Metadata = {
  title: "Meet & Greet Review | Staff",
}

export default async function StaffTrialsPage({
  searchParams,
}: {
  searchParams: Promise<{ dog?: string; owner?: string }>
}) {
  const { dog = "", owner = "" } = await searchParams

  const filters: Prisma.TrialVisitWhereInput[] = [
    ...(dog.trim() ? [{ dog: { name: { contains: dog.trim(), mode: "insensitive" as const } } }] : []),
    ...(owner.trim()
      ? [
          {
            booking: {
              customer: {
                OR: [
                  { name: { contains: owner.trim(), mode: "insensitive" as const } },
                  { email: { contains: owner.trim(), mode: "insensitive" as const } },
                ],
              },
            },
          },
        ]
      : []),
  ]

  const [pending, recent] = await Promise.all([
    prisma.trialVisit.findMany({
      where: { outcome: null, AND: filters },
      include: { dog: true, booking: { include: { customer: true } } },
      orderBy: { booking: { startDate: "asc" } },
    }),
    prisma.trialVisit.findMany({
      where: { outcome: { not: null }, AND: filters },
      include: { dog: true, booking: { include: { customer: true } } },
      orderBy: { completedAt: "desc" },
      take: 20,
    }),
  ])

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Meet & Greet Review</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mark the outcome after a trial visit — first-time boarders can&rsquo;t book overnight
          boarding until their trial is passed.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="dog">Dog name</Label>
          <Input id="dog" name="dog" defaultValue={dog} className="w-48" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="owner">Owner name or email</Label>
          <Input id="owner" name="owner" defaultValue={owner} className="w-64" />
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

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
                {trial.booking.startDate > new Date() ? (
                  <p className="text-sm text-muted-foreground">
                    Outcome can be set once the Meet & Greet date has passed.
                  </p>
                ) : (
                  <TrialOutcomeForm trialVisitId={trial.id} />
                )}
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
                    {trial.outcome ? TRIAL_OUTCOME_LABELS[trial.outcome] : ""}
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
