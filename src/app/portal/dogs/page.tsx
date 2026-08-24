import type { Metadata } from "next"
import Link from "next/link"
import { Plus, Check, TriangleAlert, Pencil } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DeleteDogButton } from "@/components/portal/delete-dog-button"
import { formatCustomerNumber, formatDogNumber } from "@/lib/customer-dog-numbers"
import type { Dog, DogMedication, VaccinationRecord } from "@/generated/prisma/client"

export const metadata: Metadata = {
  title: "My Dogs",
}

const EXPIRING_SOON_DAYS = 30

function ageYears(dob: Date | null): number | null {
  if (!dob) return null
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const monthDiff = now.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--
  return age
}

function vaccineStatus(record: VaccinationRecord): { label: string; tone: "ok" | "warn" | "bad" } {
  const now = new Date()
  const soon = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000)
  const monthYear = record.expiryDate.toLocaleDateString("en-GB", { month: "short", year: "numeric" })
  if (record.expiryDate < now) return { label: `Expired (${monthYear})`, tone: "bad" }
  if (record.expiryDate < soon) return { label: `Expiring Soon (${monthYear})`, tone: "warn" }
  return { label: `Valid (${monthYear})`, tone: "ok" }
}

function vaccineSummary(records: VaccinationRecord[]): { text: string; tone: "ok" | "warn" | "bad" | "none" } {
  if (records.length === 0) return { text: "No vaccination records", tone: "none" }
  let worst: { text: string; tone: "ok" | "warn" | "bad" } = { text: "Vaccines Up to Date", tone: "ok" }
  for (const record of records) {
    const status = vaccineStatus(record)
    if (status.tone === "bad") return { text: `${record.type} Expired`, tone: "bad" }
    if (status.tone === "warn") worst = { text: `${record.type} Expiring Soon`, tone: "warn" }
  }
  return worst
}

const TONE_TEXT_CLASSES: Record<"ok" | "warn" | "bad" | "none", string> = {
  ok: "text-emerald-600",
  warn: "text-amber-600",
  bad: "text-destructive",
  none: "text-muted-foreground",
}

export default async function DogsPage({
  searchParams,
}: {
  searchParams: Promise<{ dogId?: string }>
}) {
  const { dogId } = await searchParams
  const session = await auth()

  const [user, dogs] = await Promise.all([
    prisma.user.findUnique({ where: { id: session!.user.id } }),
    prisma.dog.findMany({
      where: { ownerId: session!.user.id },
      orderBy: { name: "asc" },
      include: {
        vaccinationRecords: true,
        medications: { orderBy: { sortOrder: "asc" } },
      },
    }),
  ])

  const selectedDog = (dogId ? dogs.find((dog) => dog.id === dogId) : dogs[0]) as
    | (Dog & { vaccinationRecords: VaccinationRecord[]; medications: DogMedication[] })
    | undefined

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Customer: {user?.name}{" "}
            {user && (
              <span className="text-sm font-normal text-muted-foreground">
                ({formatCustomerNumber(user.customerNumber)})
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {user?.phone ? `${user.phone} • ` : ""}
            {user?.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={user?.active ? "secondary" : "destructive"}>
            {user?.active ? "Account Active" : "Account Inactive"}
          </Badge>
          <Button variant="outline" size="sm" asChild>
            <Link href="/portal/account">Edit Customer</Link>
          </Button>
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Registered Dogs ({dogs.length})
        </h2>
        <div className="mt-3 flex gap-4 overflow-x-auto pb-1">
          <Link
            href="/portal/dogs/new"
            className="flex w-48 shrink-0 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-4 text-sm text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Plus className="size-5" />
            Add New Dog
          </Link>
          {dogs.map((dog) => {
            const isSelected = selectedDog?.id === dog.id
            const summary = vaccineSummary(dog.vaccinationRecords)
            return (
              <Link
                key={dog.id}
                href={`/portal/dogs?dogId=${dog.id}`}
                className={`w-48 shrink-0 rounded-lg border p-4 text-sm ${
                  isSelected ? "border-primary ring-1 ring-primary" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{dog.name}</p>
                  {isSelected && <Badge>Selected</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{formatDogNumber(dog.dogNumber)}</p>
                <p className="text-muted-foreground">{dog.breed}</p>
                <p className={`mt-2 flex items-center gap-1 text-xs ${TONE_TEXT_CLASSES[summary.tone]}`}>
                  {summary.tone === "ok" && <Check className="size-3" />}
                  {(summary.tone === "warn" || summary.tone === "bad") && (
                    <TriangleAlert className="size-3" />
                  )}
                  {summary.text}
                </p>
              </Link>
            )
          })}
        </div>
      </div>

      {selectedDog ? (
        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{selectedDog.name}</h2>
                <Badge variant="outline">{formatDogNumber(selectedDog.dogNumber)}</Badge>
                {selectedDog.microchipNumber && (
                  <Badge variant="outline" className="font-mono">
                    Microchip: #{selectedDog.microchipNumber}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {ageYears(selectedDog.dob) !== null ? `${ageYears(selectedDog.dob)} Year Old ` : ""}
                {selectedDog.sex
                  ? selectedDog.sex.charAt(0).toUpperCase() + selectedDog.sex.slice(1)
                  : "Unknown sex"}
                {selectedDog.neutered ? " (Neutered)" : ""} • {selectedDog.breed}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/portal/dogs/${selectedDog.id}`}>
                  <Pencil className="size-4" />
                  Edit Profile
                </Link>
              </Button>
              <DeleteDogButton dogId={selectedDog.id} dogName={selectedDog.name} label="Delete Dog" />
            </div>
          </div>

          <div className="grid gap-6 border-t border-border pt-5 sm:grid-cols-3">
            <div className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Physical Info
              </h3>
              <dl className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Weight:</dt>
                  <dd className="font-medium">{selectedDog.weightKg ? `${selectedDog.weightKg} kg` : "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Color:</dt>
                  <dd className="font-medium">{selectedDog.color || "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Date of Birth:</dt>
                  <dd className="font-medium">
                    {selectedDog.dob ? selectedDog.dob.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Spayed/Neutered:</dt>
                  <dd className="font-medium">{selectedDog.neutered ? "Yes" : "No"}</dd>
                </div>
              </dl>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Medical Status
              </h3>
              <dl className="space-y-1.5 text-sm">
                {selectedDog.vaccinationRecords.map((record) => {
                  const status = vaccineStatus(record)
                  return (
                    <div key={record.id} className="flex items-center justify-between gap-2">
                      <dt className="text-muted-foreground">{record.type}:</dt>
                      <dd className={`font-medium ${TONE_TEXT_CLASSES[status.tone]}`}>{status.label}</dd>
                    </div>
                  )
                })}
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Primary Vet:</dt>
                  <dd className="font-medium">{selectedDog.vetName || "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Allergies:</dt>
                  <dd className="font-medium">{selectedDog.allergies || "None"}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Medication:</dt>
                  <dd className="font-medium">{selectedDog.medicationNotes || "None"}</dd>
                </div>
                {selectedDog.medications.length > 0 && (
                  <div>
                    <dt className="mb-1 text-muted-foreground">Medical history:</dt>
                    <dd>
                      <ul className="list-disc space-y-0.5 pl-4 font-medium">
                        {selectedDog.medications.map((med) => (
                          <li key={med.id}>
                            {med.name}
                            {med.amount ? ` — ${med.amount}` : ""}
                            {" ("}
                            {med.specificTime
                              ? med.specificTime
                              : [med.am && "AM", med.pm && "PM"].filter(Boolean).join(" & ") ||
                                "no schedule set"}
                            {")"}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Boarding Requirements
              </h3>
              <dl className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Feeding:</dt>
                  <dd className="font-medium">{selectedDog.feedingNotes || "—"}</dd>
                </div>
              </dl>
            </div>
          </div>

          {selectedDog.behaviourNotes && (
            <div className="flex gap-3 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div className="text-sm">
                <p className="font-semibold text-amber-900">Kennel Handling Note</p>
                <p className="text-amber-800">{selectedDog.behaviourNotes}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No dogs yet. Add a profile to start booking.</p>
      )}
    </div>
  )
}
