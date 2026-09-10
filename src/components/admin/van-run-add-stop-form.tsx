"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { assignBookingToVanRun, type AdminActionState } from "@/app/admin/van-runs/actions"

const initialState: AdminActionState = { status: "idle" }

export type UnassignedBookingOption = {
  id: string
  bookingNumber: number
  customerName: string
  dogNames: string
  walkTypeLabel: string
}

// Lets staff add a Dog Walking booking (for this run's date, not yet on any
// run) as a stop on this run — see assignBookingToVanRun: bookings no longer
// pick a run at booking time, so this is how they end up on one.
export function VanRunAddStopForm({
  vanRunId,
  options,
}: {
  vanRunId: string
  options: UnassignedBookingOption[]
}) {
  const [state, formAction, pending] = useActionState(assignBookingToVanRun.bind(null, vanRunId), initialState)

  if (options.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No unassigned Dog Walking bookings for this run&rsquo;s date.
      </p>
    )
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="min-w-64 space-y-2">
        <Label htmlFor="bookingId">Add a booking</Label>
        <select
          id="bookingId"
          name="bookingId"
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              Booking {option.bookingNumber} — {option.customerName} — {option.dogNames} (
              {option.walkTypeLabel})
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add stop"}
      </Button>
      {state.status === "error" && (
        <p className="w-full text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
    </form>
  )
}
