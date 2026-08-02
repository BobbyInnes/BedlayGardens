import type { Metadata } from "next"
import Link from "next/link"
import { Trash2 } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { deleteVaccination } from "@/app/portal/vaccinations/actions"

export const metadata: Metadata = {
  title: "Vaccinations",
}

function statusBadge(expiryDate: Date, status: string) {
  const isExpired = expiryDate.getTime() < Date.now()
  if (isExpired) return <Badge variant="destructive">Expired</Badge>
  if (status === "VERIFIED") return <Badge>Verified</Badge>
  return <Badge variant="secondary">Unverified</Badge>
}

export default async function VaccinationsPage({
  searchParams,
}: {
  searchParams: Promise<{ dogId?: string }>
}) {
  const { dogId } = await searchParams
  const session = await auth()
  const dogs = await prisma.dog.findMany({
    where: { ownerId: session!.user.id },
    orderBy: { name: "asc" },
    include: { vaccinationRecords: { orderBy: { expiryDate: "asc" } } },
  })

  const selectedDog = (dogId ? dogs.find((dog) => dog.id === dogId) : dogs[0]) ?? undefined

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Vaccinations</h1>

      {dogs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add a dog profile first, then you can add vaccination records for them.{" "}
          <Link href="/portal/dogs/new" className="font-medium text-primary hover:underline">
            Add a dog
          </Link>
        </p>
      ) : (
        <>
          <div className="flex gap-6 border-b border-border text-sm font-medium">
            {dogs.map((dog) => {
              const isSelected = selectedDog?.id === dog.id
              return (
                <Link
                  key={dog.id}
                  href={`/portal/vaccinations?dogId=${dog.id}`}
                  className={`border-b-2 pb-3 ${
                    isSelected
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {dog.name} ({dog.vaccinationRecords.length})
                </Link>
              )
            })}
          </div>

          {selectedDog && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{selectedDog.name}</h2>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/portal/vaccinations/upload?dogId=${selectedDog.id}`}>
                      Upload certificate
                    </Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link href={`/portal/vaccinations/new?dogId=${selectedDog.id}`}>Add vaccination</Link>
                  </Button>
                </div>
              </div>

              {selectedDog.vaccinationRecords.length > 0 ? (
                <ul className="space-y-3">
                  {selectedDog.vaccinationRecords.map((record) => (
                    <li
                      key={record.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4 text-sm"
                    >
                      <div>
                        <p className="font-medium">{record.type}</p>
                        <p className="text-muted-foreground">
                          Given {record.dateGiven.toLocaleDateString("en-GB")} · Expires{" "}
                          {record.expiryDate.toLocaleDateString("en-GB")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {statusBadge(record.expiryDate, record.status)}
                        <form action={deleteVaccination.bind(null, record.id)}>
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete ${record.type} record`}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No vaccination records yet.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
