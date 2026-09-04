import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button"
import { TRIAL_OUTCOME_LABELS } from "@/lib/trial-outcome"
import { formatDogNumber } from "@/lib/customer-dog-numbers"
import { fullName } from "@/lib/format"
import { DogBypassCheckboxes } from "@/components/admin/dog-bypass-checkboxes"
import { deleteDogAdmin } from "@/app/admin/dogs/actions"

export const metadata: Metadata = {
  title: "Dogs | Admin",
}

export default async function AdminDogsPage({
  searchParams,
}: {
  searchParams: Promise<{ dog?: string; owner?: string }>
}) {
  const { dog = "", owner = "" } = await searchParams
  const session = await auth()
  const isSuperAdmin = session?.user.isSuperAdmin ?? false

  const dogs = await prisma.dog.findMany({
    where: {
      ...(dog.trim() ? { name: { contains: dog.trim(), mode: "insensitive" } } : {}),
      ...(owner.trim()
        ? {
            owner: {
              OR: [
                { forename: { contains: owner.trim(), mode: "insensitive" } },
                { surname: { contains: owner.trim(), mode: "insensitive" } },
                { email: { contains: owner.trim(), mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    include: { owner: true },
    orderBy: { createdAt: "desc" },
  })

  const trialVisits = await prisma.trialVisit.findMany({
    where: { dogId: { in: dogs.map((d) => d.id) }, outcome: { not: null } },
    orderBy: { completedAt: "desc" },
  })
  const latestOutcomeByDogId = new Map<string, (typeof trialVisits)[number]>()
  for (const tv of trialVisits) {
    if (!latestOutcomeByDogId.has(tv.dogId)) latestOutcomeByDogId.set(tv.dogId, tv)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dogs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every dog on the system ({dogs.length}). Owner details are shown alongside each dog
          since more than one dog can share the same name.
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

      {dogs.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {dogs.map((dog) => {
            const latestOutcome = latestOutcomeByDogId.get(dog.id)
            return (
              <li key={dog.id} className="flex flex-wrap items-center justify-between gap-4 p-4 text-sm">
                <div className="flex items-center gap-4">
                  {dog.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/files/${dog.photoUrl}`}
                      alt={dog.name}
                      className="size-14 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] text-muted-foreground">
                      No photo
                    </div>
                  )}
                  <div>
                    <p className="font-medium">
                      {dog.name}{" "}
                      <span className="font-normal text-muted-foreground">
                        ({formatDogNumber(dog.dogNumber)}) — {dog.breed}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Owner: {fullName(dog.owner)} ({dog.owner.email})
                    </p>
                    <p className="text-muted-foreground">
                      Added {dog.createdAt.toLocaleDateString("en-GB")}
                    </p>
                  </div>
                </div>

                <DogBypassCheckboxes
                  dogId={dog.id}
                  bypassVaccinationChecks={dog.bypassVaccinationChecks}
                  bypassMeetGreetChecks={dog.bypassMeetGreetChecks}
                />

                <div className="flex items-center gap-3">
                  {latestOutcome ? (
                    <Badge variant={latestOutcome.outcome === "PASSED" ? "default" : "destructive"}>
                      Meet &amp; Greet: {TRIAL_OUTCOME_LABELS[latestOutcome.outcome!]}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Meet &amp; Greet: Not yet done</Badge>
                  )}
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/admin/bookings?q=${encodeURIComponent(dog.owner.email)}`}>
                      Bookings
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/admin/customers/${dog.owner.id}`}>Customer</Link>
                  </Button>
                  {isSuperAdmin && (
                    <ConfirmDeleteButton
                      label="Delete"
                      title="Delete this dog?"
                      description={`This will permanently delete ${dog.name} (${dog.breed}), owner ${fullName(dog.owner)}. Only possible if this dog has no booking history. This cannot be undone.`}
                      onConfirm={deleteDogAdmin.bind(null, dog.id)}
                    />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No dogs match those filters.</p>
      )}
    </div>
  )
}
