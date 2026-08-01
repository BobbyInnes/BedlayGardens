import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { DogForm } from "@/components/portal/dog-form"
import { updateDog } from "@/app/portal/dogs/actions"
import { TRIAL_OUTCOME_LABELS } from "@/lib/trial-outcome"
import { formatPence } from "@/lib/format"

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

  const [trialVisits, bookings] = await Promise.all([
    prisma.trialVisit.findMany({
      where: { dogId, outcome: { not: null } },
      orderBy: { completedAt: "desc" },
    }),
    prisma.booking.findMany({
      where: { bookingDogs: { some: { dogId } } },
      orderBy: { startDate: "desc" },
      include: { service: true },
    }),
  ])

  const boundUpdateDog = updateDog.bind(null, dogId)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-primary underline">Edit {dog.name}</h1>

      {trialVisits.length > 0 && (
        <div className="max-w-2xl space-y-2 rounded-lg border border-border bg-muted p-4">
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,42rem)_20rem] lg:items-start">
        <DogForm dog={dog} action={boundUpdateDog} submitLabel="Save changes" />

        {bookings.length > 0 && (
          <div className="space-y-3 rounded-lg border border-border bg-muted p-4 lg:sticky lg:top-6">
            <h2 className="text-sm font-semibold">Bookings</h2>
            <ul className="divide-y divide-border text-sm">
              {bookings.map((booking) => (
                <li key={booking.id} className="space-y-1 py-2 first:pt-0 last:pb-0">
                  <p className="font-medium">{booking.service.name}</p>
                  <p className="text-muted-foreground">
                    {booking.startDate.toLocaleDateString("en-GB")}
                    {booking.endDate.getTime() !== booking.startDate.getTime()
                      ? ` – ${booking.endDate.toLocaleDateString("en-GB")}`
                      : ""}
                  </p>
                  <div className="flex items-center gap-2">
                    <span>{formatPence(booking.totalPence)}</span>
                    <Badge variant="outline">{booking.status.toLowerCase().replace(/_/g, " ")}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
