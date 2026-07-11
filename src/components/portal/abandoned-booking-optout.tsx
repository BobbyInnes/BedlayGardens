"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { setAbandonedBookingOptOut } from "@/app/portal/account/actions"

export function AbandonedBookingOptOut({ initialOptedOut }: { initialOptedOut: boolean }) {
  const [optedOut, setOptedOut] = React.useState(initialOptedOut)
  const [pending, setPending] = React.useState(false)

  async function handleChange(checked: boolean) {
    setOptedOut(checked)
    setPending(true)
    await setAbandonedBookingOptOut(checked)
    setPending(false)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        id="abandonedBookingOptOut"
        type="checkbox"
        checked={optedOut}
        disabled={pending}
        onChange={(e) => handleChange(e.target.checked)}
        className="size-4 rounded border-input"
      />
      <Label htmlFor="abandonedBookingOptOut" className="font-normal">
        Don&rsquo;t email me reminders about unfinished bookings
      </Label>
    </div>
  )
}
