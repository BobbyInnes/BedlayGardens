import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { formatPence } from "@/lib/format"
import { ServiceForm } from "@/components/admin/service-form"
import { AddonForm } from "@/components/admin/addon-form"
import { PriceRuleForm } from "@/components/admin/price-rule-form"
import { ToggleActiveButton } from "@/components/admin/toggle-active-button"
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button"
import {
  updateService,
  toggleAddonActive,
  deleteAddon,
  deletePriceRule,
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
    include: {
      addons: { orderBy: { name: "asc" } },
      priceRules: { orderBy: { startDate: "asc" } },
    },
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

      <section className="max-w-2xl space-y-4">
        <h2 className="text-lg font-semibold">Peak pricing</h2>
        <p className="text-sm text-muted-foreground">
          Date-range rules that adjust the price for new bookings — never retroactive to existing
          confirmed bookings.
        </p>
        <PriceRuleForm serviceId={service.id} />
        {service.priceRules.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {service.priceRules.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div>
                  <p className="font-medium">{rule.label}</p>
                  <p className="text-muted-foreground">
                    {rule.startDate.toLocaleDateString("en-GB")} – {rule.endDate.toLocaleDateString("en-GB")}
                    {rule.multiplier != null && ` — ×${rule.multiplier}`}
                    {rule.overridePricePence != null && ` — ${formatPence(rule.overridePricePence)} flat`}
                    {rule.minNights != null && ` — min ${rule.minNights} nights`}
                  </p>
                </div>
                <ConfirmDeleteButton
                  onConfirm={deletePriceRule.bind(null, rule.id)}
                  title={`Delete "${rule.label}"?`}
                  description="New bookings in this window will go back to the standard rate."
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No peak pricing rules yet.</p>
        )}
      </section>
    </div>
  )
}
