"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateSettings, type AdminActionState } from "@/app/admin/pricing/actions"

const initialState: AdminActionState = { status: "idle" }

export function SettingsForm({ settings }: { settings: Record<string, string> }) {
  const [state, formAction, pending] = useActionState(updateSettings, initialState)

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="deposit_percent">Deposit %</Label>
          <Input
            id="deposit_percent"
            name="deposit_percent"
            type="number"
            min={0}
            max={100}
            defaultValue={settings.deposit_percent}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="balance_due_days_before_checkin">Balance due (days before check-in)</Label>
          <Input
            id="balance_due_days_before_checkin"
            name="balance_due_days_before_checkin"
            type="number"
            min={0}
            defaultValue={settings.balance_due_days_before_checkin}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cancellation_free_days">Free cancellation window (days)</Label>
          <Input
            id="cancellation_free_days"
            name="cancellation_free_days"
            type="number"
            min={0}
            defaultValue={settings.cancellation_free_days}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cancellation_no_refund_hours">No-refund window (hours)</Label>
          <Input
            id="cancellation_no_refund_hours"
            name="cancellation_no_refund_hours"
            type="number"
            min={0}
            defaultValue={settings.cancellation_no_refund_hours}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="second_dog_discount_percent">Second dog discount %</Label>
          <Input
            id="second_dog_discount_percent"
            name="second_dog_discount_percent"
            type="number"
            min={0}
            max={100}
            defaultValue={settings.second_dog_discount_percent}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="daycare_max_capacity">Daycare max capacity (dogs/day)</Label>
          <Input
            id="daycare_max_capacity"
            name="daycare_max_capacity"
            type="number"
            min={0}
            defaultValue={settings.daycare_max_capacity}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="vat_enabled"
          name="vat_enabled"
          type="checkbox"
          defaultChecked={settings.vat_enabled === "true"}
          className="size-4 rounded border-input"
        />
        <Label htmlFor="vat_enabled" className="font-normal">
          VAT enabled
        </Label>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>

      {state.message && (
        <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
          {state.message}
        </p>
      )}
    </form>
  )
}
