"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateVatSettings, type AdminActionState } from "@/app/admin/content/actions"

const initialState: AdminActionState = { status: "idle" }

export function VatSettingsForm({
  vatNumber,
  ratePercent,
  periodStartMonth,
  periodLength,
}: {
  vatNumber: string
  ratePercent: string
  periodStartMonth: string
  periodLength: string
}) {
  const [state, formAction, pending] = useActionState(updateVatSettings, initialState)

  return (
    <form action={formAction} className="max-w-2xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="vat_number">VAT registration number</Label>
          <Input id="vat_number" name="vat_number" defaultValue={vatNumber} placeholder="GB123456789" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vat_rate_percent">VAT rate (%)</Label>
          <Input
            id="vat_rate_percent"
            name="vat_rate_percent"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={ratePercent}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vat_period_start_month">VAT period start month</Label>
          <select
            id="vat_period_start_month"
            name="vat_period_start_month"
            defaultValue={periodStartMonth}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {[
              "January", "February", "March", "April", "May", "June",
              "July", "August", "September", "October", "November", "December",
            ].map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="vat_period_length">VAT period length</Label>
          <select
            id="vat_period_length"
            name="vat_period_length"
            defaultValue={periodLength}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="ANNUALLY">Annually</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state.message && (
          <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  )
}
