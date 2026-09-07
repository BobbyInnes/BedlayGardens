"use client"

import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

// Uncontrolled — submitted as part of the surrounding <form> via FormData,
// same pattern as every other register-form field (see register-form.tsx).
// Radix's Switch renders a hidden native checkbox when given `name`/`value`,
// so it participates in the form post like a normal checkbox: present with
// value "on" when checked, absent when not.
export function NotificationSettingsFields({
  defaultPetCareEmail,
  defaultMarketingEmail,
  defaultPetCareSms,
}: {
  defaultPetCareEmail: boolean
  defaultMarketingEmail: boolean
  defaultPetCareSms: boolean
}) {
  return (
    <div className="space-y-3">
      <Label className="font-bold text-primary">Notification settings</Label>

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
          <Label htmlFor="notifyPetCareEmail" className="font-normal">
            Pet Care Updates
          </Label>
          <Switch id="notifyPetCareEmail" name="notifyPetCareEmail" value="on" defaultChecked={defaultPetCareEmail} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="notifyMarketingEmail" className="font-normal">
            Marketing Emails
          </Label>
          <Switch
            id="notifyMarketingEmail"
            name="notifyMarketingEmail"
            value="on"
            defaultChecked={defaultMarketingEmail}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-3">
        <p className="text-sm font-medium">SMS Notifications</p>

        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="notifyPetCareSms" className="font-normal">
            Pet Care Updates
          </Label>
          <Switch id="notifyPetCareSms" name="notifyPetCareSms" value="on" defaultChecked={defaultPetCareSms} />
        </div>
        <p className="text-xs text-muted-foreground">
          Requires a Mobile Tel-No above. Booking confirmations and receipts are only sent by email.
        </p>
      </div>
    </div>
  )
}
