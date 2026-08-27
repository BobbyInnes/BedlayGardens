import type { Metadata } from "next"
import { Fragment } from "react"
import Link from "next/link"
import { Plus, Check, TriangleAlert, Pencil } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DeleteDogButton } from "@/components/portal/delete-dog-button"
import { formatCustomerNumber, formatDogNumber } from "@/lib/customer-dog-numbers"
import { fullName } from "@/lib/format"
import type {
  Dog,
  DogFeedingItem,
  DogMedication,
  IncidentReport,
  TrialVisit,
  User,
  VaccinationRecord,
} from "@/generated/prisma/client"

export const metadata: Metadata = {
  title: "My Dogs",
}

const EXPIRING_SOON_DAYS = 30

function ageYearsMonths(dob: Date | null): { years: number; months: number } | null {
  if (!dob) return null
  const now = new Date()
  let years = now.getFullYear() - dob.getFullYear()
  let months = now.getMonth() - dob.getMonth()
  if (now.getDate() < dob.getDate()) months--
  if (months < 0) {
    years--
    months += 12
  }
  if (years < 0) return null
  return { years, months }
}

function formatAge(age: { years: number; months: number } | null): string {
  if (!age) return ""
  const parts: string[] = []
  if (age.years > 0) parts.push(`${age.years} Year${age.years === 1 ? "" : "s"}`)
  if (age.months > 0 || age.years === 0) parts.push(`${age.months} Month${age.months === 1 ? "" : "s"}`)
  return `${parts.join(" ")} Old `
}

type VaccineStatusKind = "expired" | "unverified" | "expiring_soon" | "valid"

// A vaccine's expiry date is only meaningful once staff have actually
// verified the uploaded certificate — until then it reads as "Awaiting
// verification" regardless of dates, never as Valid/Expiring Soon.
function vaccineStatus(
  record: VaccinationRecord
): { label: string; tone: "ok" | "warn" | "bad"; kind: VaccineStatusKind } {
  const now = new Date()
  const soon = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000)
  const monthYear = record.expiryDate.toLocaleDateString("en-GB", { month: "short", year: "numeric" })
  if (record.expiryDate < now || record.status === "EXPIRED") {
    return { label: `Expired (${monthYear})`, tone: "bad", kind: "expired" }
  }
  if (record.status === "UNVERIFIED") {
    return { label: "Awaiting verification", tone: "warn", kind: "unverified" }
  }
  if (record.expiryDate < soon) {
    return { label: `Expiring Soon (${monthYear})`, tone: "warn", kind: "expiring_soon" }
  }
  return { label: `Valid (${monthYear})`, tone: "ok", kind: "valid" }
}

function vaccineSummary(records: VaccinationRecord[]): { text: string; tone: "ok" | "warn" | "bad" | "none" } {
  if (records.length === 0) return { text: "No vaccination records", tone: "none" }
  let worst: { text: string; tone: "ok" | "warn" | "bad" } = { text: "Vaccines Up to Date", tone: "ok" }
  for (const record of records) {
    const status = vaccineStatus(record)
    if (status.tone === "bad") return { text: `${record.type} Expired`, tone: "bad" }
    if (status.kind === "unverified") worst = { text: `${record.type} Awaiting Verification`, tone: "warn" }
    else if (status.kind === "expiring_soon" && worst.tone === "ok") {
      worst = { text: `${record.type} Expiring Soon`, tone: "warn" }
    }
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
        feedingItems: { orderBy: { sortOrder: "asc" } },
        // Most recent Meet & Greet evaluation only — the edit-dog page shows
        // the full history if needed.
        trialVisits: { orderBy: { completedAt: "desc" }, take: 1 },
        incidentReports: { include: { reportedBy: true }, orderBy: { createdAt: "desc" } },
      },
    }),
  ])

  const selectedDog = (dogId ? dogs.find((dog) => dog.id === dogId) : dogs[0]) as
    | (Dog & {
        vaccinationRecords: VaccinationRecord[]
        medications: DogMedication[]
        feedingItems: DogFeedingItem[]
        trialVisits: TrialVisit[]
        incidentReports: (IncidentReport & { reportedBy: User })[]
      })
    | undefined

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Customer: {user && fullName(user)}{" "}
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
                {formatAge(ageYearsMonths(selectedDog.dob))}
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
              <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Weight:</dt>
                <dd className="font-medium">{selectedDog.weightKg ? `${selectedDog.weightKg} kg` : "—"}</dd>
                <dt className="text-muted-foreground">Color:</dt>
                <dd className="font-medium">{selectedDog.color || "—"}</dd>
                <dt className="text-muted-foreground">Date of Birth:</dt>
                <dd className="font-medium">
                  {selectedDog.dob ? selectedDog.dob.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"}
                </dd>
                <dt className="text-muted-foreground">Spayed/Neutered:</dt>
                <dd className="font-medium">{selectedDog.neutered ? "Yes" : "No"}</dd>
              </dl>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Medical Status
              </h3>
              <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Allergies:</dt>
                <dd className="font-medium">{selectedDog.allergies || "None"}</dd>
                <dt className="col-span-2 text-muted-foreground">Medical history:</dt>
                <dd className="col-span-2 space-y-2">
                  <div>
                    <span className="text-muted-foreground">Summary: </span>
                    <span className="font-medium">{selectedDog.medicalHistorySummary || "None"}</span>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Medications</p>
                    {selectedDog.medications.length > 0 ? (
                      <ul className="list-disc space-y-0.5 pl-4 font-medium">
                        {selectedDog.medications.map((med) => (
                          <li key={med.id}>
                            {med.name}
                            {med.amount ? ` — ${med.amount}` : ""}
                            {" ("}
                            {med.specificTime
                              ? med.specificTime
                              : [med.am && "AM", med.noon && "Noon", med.pm && "PM"]
                                  .filter(Boolean)
                                  .join(" & ") || "no schedule set"}
                            {")"}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="font-medium">None</p>
                    )}
                  </div>
                </dd>
              </dl>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Boarding Requirements
              </h3>
              <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-sm">
                {selectedDog.feedingItems.length > 0 ? (
                  <>
                    <dt className="col-span-2 text-muted-foreground">Feeding:</dt>
                    <dd className="col-span-2">
                      <ul className="list-disc space-y-0.5 pl-4 font-medium">
                        {selectedDog.feedingItems.map((item) => (
                          <li key={item.id}>
                            {item.item}
                            {item.amount ? ` — ${item.amount}` : ""}
                            {" ("}
                            {item.specificTime
                              ? item.specificTime
                              : [item.am && "AM", item.pm && "PM"].filter(Boolean).join(" & ") ||
                                "no schedule set"}
                            {")"}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </>
                ) : (
                  <>
                    <dt className="text-muted-foreground">Feeding:</dt>
                    <dd className="font-medium">—</dd>
                  </>
                )}
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
      ) : null}

      {selectedDog && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Vaccination Information</h2>
          {selectedDog.vaccinationRecords.length > 0 ? (
            <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-sm">
              {selectedDog.vaccinationRecords.map((record) => {
                const status = vaccineStatus(record)
                return (
                  <Fragment key={record.id}>
                    <dt className="text-muted-foreground">{record.type}:</dt>
                    <dd className="font-medium">
                      <span className={TONE_TEXT_CLASSES[status.tone]}>{status.label}</span>
                      {" — given "}
                      {record.dateGiven.toLocaleDateString("en-GB")}
                      {", expires "}
                      {record.expiryDate.toLocaleDateString("en-GB")}
                    </dd>
                  </Fragment>
                )
              })}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              No vaccination details on file yet.
            </p>
          )}
        </div>
      )}

      {selectedDog && (() => {
        const trial = selectedDog.trialVisits[0]
        return (
          <div className="space-y-3 rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">
              Evaluation Information
              {!trial?.outcome && (
                <span className="ml-2 text-sm font-normal text-destructive">
                  (Evaluation is outstanding)
                </span>
              )}
            </h2>
            <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Evaluation Complete:</dt>
              <dd className="font-medium">{trial ? (trial.outcome ? "Yes" : "No") : "—"}</dd>
              <dt className="text-muted-foreground">Evaluation Passed:</dt>
              <dd className="font-medium">
                {trial ? (trial.outcome && trial.outcome !== "NOT_SUITABLE" ? "Yes" : "No") : "—"}
              </dd>
              <dt className="text-muted-foreground">Evaluation Date:</dt>
              <dd className="font-medium">
                {trial?.completedAt ? trial.completedAt.toLocaleDateString("en-GB") : "—"}
              </dd>
              <dt className="col-span-2 text-muted-foreground">Evaluation Notes:</dt>
              <dd className="col-span-2 font-medium">{trial?.notes || "—"}</dd>
            </dl>
            {!trial && (
              <p className="text-sm text-muted-foreground">
                This will be completed after a Meet &amp; Greet.
              </p>
            )}
          </div>
        )
      })()}

      {selectedDog && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Incident Reports</h2>
          {selectedDog.incidentReports.length > 0 ? (
            <ul className="space-y-4">
              {selectedDog.incidentReports.map((incident) => (
                <li key={incident.id} className="space-y-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
                  <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-sm">
                    <dt className="text-muted-foreground">Severity:</dt>
                    <dd className="font-medium">
                      <Badge
                        variant={
                          incident.severity === "High"
                            ? "destructive"
                            : incident.severity === "Medium"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {incident.severity}
                      </Badge>
                    </dd>
                    <dt className="text-muted-foreground">Date &amp; Time:</dt>
                    <dd className="font-medium">
                      {incident.createdAt.toLocaleString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </dd>
                    <dt className="text-muted-foreground">Recorded By:</dt>
                    <dd className="font-medium">{fullName(incident.reportedBy)}</dd>
                    <dt className="text-muted-foreground">Owner Informed:</dt>
                    <dd className="font-medium">{incident.ownerInformed ? "Yes" : "No"}</dd>
                    <dt className="col-span-2 text-muted-foreground">Description:</dt>
                    <dd className="col-span-2 font-medium">{incident.description}</dd>
                  </dl>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No incidents have been reported.</p>
          )}
        </div>
      )}

      {!selectedDog && (
        <p className="text-sm text-muted-foreground">No dogs yet. Add a profile to start booking.</p>
      )}
    </div>
  )
}
