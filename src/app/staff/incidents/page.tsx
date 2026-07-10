import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { IncidentForm } from "@/components/staff/incident-form"

export const metadata: Metadata = {
  title: "Incidents | Staff",
}

const ON_SITE_SERVICE_SLUGS = ["overnight-boarding", "daycare"]

export default async function StaffIncidentsPage() {
  const [inHouseBookings, incidents] = await Promise.all([
    prisma.booking.findMany({
      where: { status: "CHECKED_IN", service: { slug: { in: ON_SITE_SERVICE_SLUGS } } },
      include: { customer: true, bookingDogs: { include: { dog: true } } },
    }),
    prisma.incidentReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { dog: true, reportedBy: true },
    }),
  ])

  const inHouseDogs = inHouseBookings.flatMap((booking) =>
    booking.bookingDogs.map((bd) => ({
      dogId: bd.dogId,
      dogName: bd.dog.name,
      bookingId: booking.id,
      customerName: booking.customer.name,
    }))
  )

  const severityVariant = (severity: string) =>
    severity === "High" ? "destructive" : severity === "Medium" ? "secondary" : "outline"

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Incidents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Log an incident for a dog currently in-house.
        </p>
      </div>

      <IncidentForm inHouseDogs={inHouseDogs} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent incidents</h2>
        {incidents.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {incidents.map((incident) => (
              <li key={incident.id} className="space-y-1 p-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{incident.dog.name}</span>
                  <Badge variant={severityVariant(incident.severity)}>{incident.severity}</Badge>
                </div>
                <p className="text-muted-foreground">{incident.description}</p>
                <p className="text-xs text-muted-foreground">
                  {incident.reportedBy.name} — {incident.createdAt.toLocaleDateString("en-GB")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No incidents logged yet.</p>
        )}
      </section>
    </div>
  )
}
