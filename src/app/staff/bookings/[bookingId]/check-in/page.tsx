import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { checkVaccinationGate } from "@/lib/vaccination-gate"
import { CheckInForm } from "@/components/staff/check-in-form"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle } from "lucide-react"

export const metadata: Metadata = {
  title: "Check In | Staff",
}

export default async function StaffCheckInPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const { bookingId } = await params

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, service: true, bookingDogs: { include: { dog: true } } },
  })
  if (!booking) notFound()

  const dogIds = booking.bookingDogs.map((bd) => bd.dogId)
  const gate = await checkVaccinationGate(dogIds, booking.endDate)

  const isBoarding = booking.service.slug === "overnight-boarding"
  const kennelUnits = isBoarding
    ? await prisma.kennelUnit.findMany({ where: { active: true }, orderBy: { name: "asc" } })
    : []

  const pastIncidents = await prisma.incidentReport.findMany({
    where: { dogId: { in: dogIds } },
    orderBy: { createdAt: "desc" },
    include: { dog: true },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Check in — {booking.bookingDogs.map((bd) => bd.dog.name).join(", ")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {booking.customer.name} — {booking.service.name}
        </p>
      </div>

      {pastIncidents.length > 0 && (
        <div className="max-w-lg space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
            Past incidents on file
          </p>
          <ul className="space-y-2 text-sm">
            {pastIncidents.map((incident) => (
              <li key={incident.id} className="flex items-start justify-between gap-2">
                <span>
                  <strong>{incident.dog.name}</strong>: {incident.description}
                </span>
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
              </li>
            ))}
          </ul>
        </div>
      )}

      <CheckInForm
        bookingId={booking.id}
        isBoarding={isBoarding}
        currentKennelUnitId={booking.kennelUnitId}
        kennelUnits={kennelUnits}
        gateOk={gate.ok}
        perDog={gate.perDog}
      />
    </div>
  )
}
