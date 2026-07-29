import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { DogForm } from "@/components/portal/dog-form"
import { updateDog } from "@/app/portal/dogs/actions"
import { TRIAL_OUTCOME_LABELS } from "@/lib/trial-outcome"

export const metadata: Metadata = {
  title: "Edit Dog",
}

export default async function EditDogPage({
  params,
}: {
  params: Promise<{ dogId: string }>
}) {
  const { dogId } = await params
  const session = await auth()
  const dog = await prisma.dog.findUnique({ where: { id: dogId } })

  if (!dog || dog.ownerId !== session!.user.id) {
    notFound()
  }

  const trialVisits = await prisma.trialVisit.findMany({
    where: { dogId, outcome: { not: null } },
    orderBy: { completedAt: "desc" },
  })

  const boundUpdateDog = updateDog.bind(null, dogId)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit {dog.name}</h1>

      {trialVisits.length > 0 && (
        <div className="max-w-2xl space-y-2 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold">Meet &amp; Greet outcome</h2>
          {trialVisits.map((tv) => (
            <div key={tv.id} className="flex flex-wrap items-start justify-between gap-2 text-sm">
              <div>
                {tv.notes && <p className="text-muted-foreground">{tv.notes}</p>}
                {tv.completedAt && (
                  <p className="text-xs text-muted-foreground">
                    {tv.completedAt.toLocaleDateString("en-GB")}
                  </p>
                )}
              </div>
              <Badge variant={tv.outcome === "PASSED" ? "default" : "destructive"}>
                {TRIAL_OUTCOME_LABELS[tv.outcome!]}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <DogForm dog={dog} action={boundUpdateDog} submitLabel="Save changes" />
    </div>
  )
}
