import type { Metadata } from "next"
import { Fragment } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, TriangleAlert } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDogNumber } from "@/lib/customer-dog-numbers"
import { fullName } from "@/lib/format"
import { ageYearsMonths, formatAge, vaccineStatus, TONE_TEXT_CLASSES } from "@/lib/dog-details"

export const metadata: Metadata = {
  title: "Dog Details | Admin",
}

export default async function AdminDogDetailPage({
  params,
}: {
  params: Promise<{ dogId: string }>
}) {
  const { dogId } = await params

  const dog = await prisma.dog.findUnique({
    where: { id: dogId },
    include: {
      owner: true,
      vaccinationRecords: true,
      medications: { orderBy: { sortOrder: "asc" } },
      // Most recent Meet & Greet evaluation only, same as the customer portal.
      trialVisits: { orderBy: { completedAt: "desc" }, take: 1 },
      incidentReports: { include: { reportedBy: true }, orderBy: { createdAt: "desc" } },
    },
  })
  if (!dog) notFound()

  const trial = dog.trialVisits[0]

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/admin/dogs">
            <ArrowLeft className="size-4" />
            Back to Dogs
          </Link>
        </Button>

        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold">{dog.name}</h1>
                <Badge variant="outline">{formatDogNumber(dog.dogNumber)}</Badge>
                {dog.microchipNumber && (
                  <Badge variant="outline" className="font-mono">
                    Microchip: #{dog.microchipNumber}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {formatAge(ageYearsMonths(dog.dob))}
                {dog.sex ? dog.sex.charAt(0).toUpperCase() + dog.sex.slice(1) : "Unknown sex"}
                {dog.neutered ? " (Neutered)" : ""} • {dog.breed}
              </p>
              <p className="text-sm text-muted-foreground">
                Owner:{" "}
                <Link href={`/admin/customers/${dog.owner.id}`} className="underline">
                  {fullName(dog.owner)}
                </Link>{" "}
                ({dog.owner.email})
              </p>
            </div>
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/admin/customers/${dog.owner.id}`}>Edit via Customer Page</Link>
            </Button>
          </div>

          <div className="grid gap-6 border-t border-border pt-5 sm:grid-cols-2">
            <div className="space-y-2">
              <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Physical Info
              </h2>
              <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Weight:</dt>
                <dd className="font-medium">{dog.weightKg ? `${dog.weightKg} kg` : "—"}</dd>
                <dt className="text-muted-foreground">Color:</dt>
                <dd className="font-medium">{dog.color || "—"}</dd>
                <dt className="text-muted-foreground">Date of Birth:</dt>
                <dd className="font-medium">
                  {dog.dob
                    ? dog.dob.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                    : "—"}
                </dd>
                <dt className="text-muted-foreground">Spayed/Neutered:</dt>
                <dd className="font-medium">{dog.neutered ? "Yes" : "No"}</dd>
              </dl>
            </div>

            <div className="space-y-2">
              <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Medical Status
              </h2>
              <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Allergies:</dt>
                <dd className="font-medium">{dog.allergies || "None"}</dd>
                <dt className="col-span-2 text-muted-foreground">Medical history:</dt>
                <dd className="col-span-2 space-y-2">
                  <div>
                    <span className="text-muted-foreground">Summary: </span>
                    <span className="font-medium">{dog.medicalHistorySummary || "None"}</span>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Medications</p>
                    {dog.medications.length > 0 ? (
                      <ul className="list-disc space-y-0.5 pl-4 font-medium">
                        {dog.medications.map((med) => (
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
          </div>

          {dog.behaviourNotes && (
            <div className="flex gap-3 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div className="text-sm">
                <p className="font-semibold text-amber-900">Kennel Handling Note</p>
                <p className="text-amber-800">{dog.behaviourNotes}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">
          Vaccination Information
          {dog.bypassVaccinationChecks && (
            <span className="ml-2 text-sm font-normal text-destructive">(Bypassed by Admin)</span>
          )}
        </h2>
        {dog.vaccinationRecords.length > 0 ? (
          <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-sm">
            {dog.vaccinationRecords.map((record) => {
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
          <p className="text-sm text-muted-foreground">No vaccination details on file yet.</p>
        )}
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">Vaccination notes:</p>
          <p className="font-medium whitespace-pre-line">{dog.vaccinationNotes || "—"}</p>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">
          Evaluation Information
          {dog.bypassMeetGreetChecks ? (
            <span className="ml-2 text-sm font-normal text-destructive">(Bypassed by Admin)</span>
          ) : (
            !trial?.outcome && (
              <span className="ml-2 text-sm font-normal text-destructive">(Evaluation is outstanding)</span>
            )
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
          <dd className="font-medium">{trial?.completedAt ? trial.completedAt.toLocaleDateString("en-GB") : "—"}</dd>
          <dt className="col-span-2 text-muted-foreground">Evaluation Notes:</dt>
          <dd className="col-span-2 font-medium">{trial?.notes || "—"}</dd>
        </dl>
        {!trial && (
          <p className="text-sm text-muted-foreground">This will be completed after a Meet &amp; Greet.</p>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Incident Reports</h2>
        {dog.incidentReports.length > 0 ? (
          <ul className="space-y-4">
            {dog.incidentReports.map((incident) => (
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
    </div>
  )
}
