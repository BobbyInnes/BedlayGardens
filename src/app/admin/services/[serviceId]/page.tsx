import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { formatPence } from "@/lib/format"
import { ServiceForm } from "@/components/admin/service-form"
import { AddonForm } from "@/components/admin/addon-form"
import { ToggleActiveButton } from "@/components/admin/toggle-active-button"
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button"
import {
  updateService,
  toggleAddonActive,
  deleteAddon,
} from "@/app/admin/services/actions"

export const metadata: Metadata = {
  title: "Edit Service | Admin",
}

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>
}) {
  const { serviceId } = await params
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { addons: { orderBy: { name: "asc" } } },
  })
  if (!service) notFound()

  const boundUpdateService = updateService.bind(null, serviceId)

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit {service.name}</h1>
      </div>

      <ServiceForm service={service} action={boundUpdateService} submitLabel="Save changes" />

      <section className="max-w-2xl space-y-4">
        <h2 className="text-lg font-semibold">Add-ons</h2>
        <AddonForm serviceId={service.id} />
        {service.addons.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {service.addons.map((addon) => (
              <li key={addon.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div>
                  <p className="font-medium">{addon.name}</p>
                  {addon.description && <p className="text-muted-foreground">{addon.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatPence(addon.pricePence)}</span>
                  <ToggleActiveButton
                    active={addon.active}
                    onToggle={toggleAddonActive.bind(null, addon.id)}
                  />
                  <ConfirmDeleteButton
                    onConfirm={deleteAddon.bind(null, addon.id)}
                    title={`Delete ${addon.name}?`}
                    description="Add-ons already used on a booking are deactivated instead of deleted."
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No add-ons yet.</p>
        )}
      </section>
    </div>
  )
}
