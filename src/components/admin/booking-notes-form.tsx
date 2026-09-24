"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { updateBookingNotes } from "@/app/admin/bookings/actions"

export function BookingNotesForm({
  bookingId,
  notes,
  belongings,
}: {
  bookingId: string
  notes: string | null
  belongings: string | null
}) {
  const [notesValue, setNotesValue] = React.useState(notes ?? "")
  const [belongingsValue, setBelongingsValue] = React.useState(belongings ?? "")
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<{ text: string; error: boolean } | null>(null)

  const unchanged = notesValue === (notes ?? "") && belongingsValue === (belongings ?? "")

  async function handleSubmit() {
    setPending(true)
    setMessage(null)
    const result = await updateBookingNotes(bookingId, notesValue, belongingsValue)
    setMessage({ text: result.message ?? "", error: result.status === "error" })
    setPending(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-2">
        <Textarea
          id="bookingNotes"
          aria-label="Booking notes"
          value={notesValue}
          onChange={(e) => setNotesValue(e.target.value)}
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bookingBelongings" className="font-bold">
          Belongings
        </Label>
        <Textarea
          id="bookingBelongings"
          value={belongingsValue}
          onChange={(e) => setBelongingsValue(e.target.value)}
          rows={3}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" disabled={pending || unchanged} onClick={handleSubmit}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {message && (
          <p className={message.error ? "text-sm text-destructive" : "text-sm text-primary"}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}
