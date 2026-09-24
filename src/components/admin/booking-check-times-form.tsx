"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateBookingCheckTimes } from "@/app/admin/bookings/actions"

// datetime-local inputs work in the viewer's local wall-clock time, with no
// timezone in the string — unlike the rest of this app's dates (see the note
// atop src/lib/dates.ts), which are deliberately UTC-only. That convention
// doesn't fit here: check-in/check-out is a real moment staff observed on a
// clock, so it's read/written in local time and converted to/from a proper
// UTC Date only at the browser/server boundary.
function toLocalInputValue(date: Date | null): string {
  if (!date) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function toIsoOrNull(localValue: string): string | null {
  if (!localValue) return null
  const parsed = new Date(localValue)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export function BookingCheckTimesForm({
  bookingId,
  checkedInAt,
  checkedOutAt,
}: {
  bookingId: string
  checkedInAt: Date | null
  checkedOutAt: Date | null
}) {
  const initialCheckedIn = toLocalInputValue(checkedInAt)
  const initialCheckedOut = toLocalInputValue(checkedOutAt)
  const [checkedInValue, setCheckedInValue] = React.useState(initialCheckedIn)
  const [checkedOutValue, setCheckedOutValue] = React.useState(initialCheckedOut)
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<{ text: string; error: boolean } | null>(null)

  const unchanged = checkedInValue === initialCheckedIn && checkedOutValue === initialCheckedOut

  async function handleSubmit() {
    setPending(true)
    setMessage(null)
    const result = await updateBookingCheckTimes(
      bookingId,
      toIsoOrNull(checkedInValue),
      toIsoOrNull(checkedOutValue)
    )
    setMessage({ text: result.message ?? "", error: result.status === "error" })
    setPending(false)
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="checkedInAt">Entered premises</Label>
        <Input
          id="checkedInAt"
          type="datetime-local"
          value={checkedInValue}
          onChange={(e) => setCheckedInValue(e.target.value)}
          className="w-56"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="checkedOutAt">Left premises</Label>
        <Input
          id="checkedOutAt"
          type="datetime-local"
          value={checkedOutValue}
          onChange={(e) => setCheckedOutValue(e.target.value)}
          className="w-56"
        />
      </div>
      <Button type="button" variant="outline" disabled={pending || unchanged} onClick={handleSubmit}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {message && (
        <p className={message.error ? "text-sm text-destructive" : "text-sm text-primary"}>
          {message.text}
        </p>
      )}
    </div>
  )
}
