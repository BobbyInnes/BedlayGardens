"use client"

import * as React from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { setNotificationPreference } from "@/app/portal/account/actions"

type Category = "petCareUpdates" | "marketing"
type Channel = "email" | "sms"

export function NotificationSettingsForm({
  petCareEmail,
  petCareSms,
  marketingEmail,
}: {
  petCareEmail: boolean
  petCareSms: boolean
  marketingEmail: boolean
}) {
  const [state, setState] = React.useState({ petCareEmail, petCareSms, marketingEmail })
  const [pending, setPending] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function toggle(category: Category, channel: Channel, key: keyof typeof state, checked: boolean) {
    const key_ = `${category}-${channel}`
    setError(null)
    setState((s) => ({ ...s, [key]: checked }))
    setPending(key_)
    const result = await setNotificationPreference(category, channel, checked)
    setPending(null)
    if (result.status === "error") {
      // Revert — the write was rejected (e.g. no mobile number on file yet).
      setState((s) => ({ ...s, [key]: !checked }))
      setError(result.message ?? "Couldn't save that change.")
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-lg border border-border p-3">
        <p className="text-sm font-medium">Email Notifications</p>

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm">Booking Confirmations &amp; Reminders</p>
            <p className="text-xs text-amber-600">
              Mandatory for booking confirmation and payment receipts. Cannot be turned off.
            </p>
          </div>
          <Switch defaultChecked disabled />
        </div>

        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="petCareEmail" className="font-normal">
            Pet Care Updates
          </Label>
          <Switch
            id="petCareEmail"
            checked={state.petCareEmail}
            disabled={pending === "petCareUpdates-email"}
            onCheckedChange={(checked) => toggle("petCareUpdates", "email", "petCareEmail", checked)}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="marketingEmail" className="font-normal">
            Marketing Emails
          </Label>
          <Switch
            id="marketingEmail"
            checked={state.marketingEmail}
            disabled={pending === "marketing-email"}
            onCheckedChange={(checked) => toggle("marketing", "email", "marketingEmail", checked)}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-3">
        <p className="text-sm font-medium">SMS Notifications</p>

        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="petCareSms" className="font-normal">
            Pet Care Updates
          </Label>
          <Switch
            id="petCareSms"
            checked={state.petCareSms}
            disabled={pending === "petCareUpdates-sms"}
            onCheckedChange={(checked) => toggle("petCareUpdates", "sms", "petCareSms", checked)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Requires a Mobile Tel-No on file. Booking confirmations and receipts are only sent by email.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
