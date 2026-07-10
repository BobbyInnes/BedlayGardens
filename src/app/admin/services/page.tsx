import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatPriceWithSuffix } from "@/lib/format"
import { ToggleActiveButton } from "@/components/admin/toggle-active-button"
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button"
import { toggleServiceActive, deleteService } from "@/app/admin/services/actions"

export const metadata: Metadata = {
  title: "Services | Admin",
}

export default async function AdminServicesPage() {
  const services = await prisma.service.findMany({ orderBy: { sortOrder: "asc" } })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
        <Button size="sm" asChild>
          <Link href="/admin/services/new">Add service</Link>
        </Button>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {services.map((service) => (
          <li key={service.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{service.name}</span>
                <Badge variant={service.active ? "default" : "secondary"}>
                  {service.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {formatPriceWithSuffix(service.basePricePence, service.pricingModel)} — /{service.slug}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/services/${service.id}`}>Edit</Link>
              </Button>
              <ToggleActiveButton
                active={service.active}
                onToggle={toggleServiceActive.bind(null, service.id)}
              />
              <ConfirmDeleteButton
                onConfirm={deleteService.bind(null, service.id)}
                title={`Delete ${service.name}?`}
                description="Services with historical bookings are deactivated instead of deleted, to preserve booking records."
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
