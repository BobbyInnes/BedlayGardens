import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getSettings } from "@/lib/settings"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SettingsForm } from "@/components/admin/settings-form"
import { KennelUnitForm } from "@/components/admin/kennel-unit-form"
import { BlockedDateForm } from "@/components/admin/blocked-date-form"
import { ToggleActiveButton } from "@/components/admin/toggle-active-button"
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button"
import {
  toggleKennelUnitActive,
  deleteKennelUnit,
  deleteBlockedDate,
} from "@/app/admin/pricing/actions"

export const metadata: Metadata = {
  title: "Pricing & Capacity | Admin",
}

export default async function AdminPricingPage() {
  const [settings, kennelUnits, blockedDates] = await Promise.all([
    getSettings(),
    prisma.kennelUnit.findMany({ orderBy: { name: "asc" } }),
    prisma.blockedDate.findMany({
      orderBy: { date: "asc" },
      include: { kennelUnit: true },
      where: { date: { gte: new Date() } },
    }),
  ])

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pricing & Capacity</h1>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Settings</h2>
        <SettingsForm settings={settings} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Kennel units</h2>
        <KennelUnitForm />
        {kennelUnits.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {kennelUnits.map((unit) => (
              <li key={unit.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{unit.name}</span>
                  <span className="text-muted-foreground">
                    {unit.size}, up to {unit.dogCapacity} dogs
                  </span>
                  <Badge variant={unit.active ? "default" : "secondary"}>
                    {unit.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/pricing/kennel-units/${unit.id}`}>Edit</Link>
                  </Button>
                  <ToggleActiveButton
                    active={unit.active}
                    onToggle={toggleKennelUnitActive.bind(null, unit.id)}
                  />
                  <ConfirmDeleteButton
                    onConfirm={deleteKennelUnit.bind(null, unit.id)}
                    title={`Delete ${unit.name}?`}
                    description="Kennels with historical bookings are deactivated instead of deleted."
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No kennel units yet.</p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Blocked dates</h2>
        <BlockedDateForm kennelUnits={kennelUnits} />
        {blockedDates.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {blockedDates.map((blocked) => (
              <li key={blocked.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div>
                  <span className="font-medium">{blocked.date.toLocaleDateString("en-GB")}</span>{" "}
                  <span className="text-muted-foreground">
                    — {blocked.kennelUnit ? blocked.kennelUnit.name : "Site-wide"}
                    {blocked.reason ? ` (${blocked.reason})` : ""}
                  </span>
                </div>
                <ConfirmDeleteButton
                  onConfirm={deleteBlockedDate.bind(null, blocked.id)}
                  title="Remove this blocked date?"
                  description="This will make the date available for booking again."
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No upcoming blocked dates.</p>
        )}
      </section>
    </div>
  )
}
