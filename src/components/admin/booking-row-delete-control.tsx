"use client"

import * as React from "react"
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button"
import { deleteBookingAdmin } from "@/app/admin/bookings/actions"

// Per-row escape hatch on the Bookings list, super-admin only — ticking the
// checkbox unlocks a Delete button for that one booking (with the usual
// confirm dialog), rather than the row's Delete being live all the time.
// Deliberately a sibling of the row's own <Link>, not nested inside it, so
// this doesn't sit inside an <a> (invalid HTML, unreliable click handling).
export function BookingRowDeleteControl({ bookingId }: { bookingId: string }) {
  const [enabled, setEnabled] = React.useState(false)

  return (
    <div className="flex shrink-0 items-center gap-2">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => setEnabled(e.target.checked)}
        className="size-4 rounded border-input"
        aria-label="Enable delete for this booking"
      />
      {enabled && (
        <ConfirmDeleteButton
          label="Delete"
          title="Delete this booking?"
          description="This will permanently delete this booking. This cannot be undone."
          onConfirm={() => deleteBookingAdmin(bookingId)}
        />
      )}
    </div>
  )
}
