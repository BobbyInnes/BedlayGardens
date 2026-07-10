"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { modifyBookingDates, type ModifyDatesState } from "@/app/admin/bookings/actions"

const initialState: ModifyDatesState = { status: "idle" }

export function BookingDatesForm({
  bookingId,
  serviceSlug,
  startDate,
  endDate,
}: {
  bookingId: string
  serviceSlug: string
  startDate: string
  endDate: string
}) {
  const [state, formAction, pending] = useActionState(
    modifyBookingDates.bind(null, bookingId),
    initialState
  )

  if (serviceSlug === "overnight-boarding") {
    return (
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="startDate">Check-in</Label>
          <Input id="startDate" name="startDate" type="date" defaultValue={startDate} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">Check-out</Label>
          <Input id="endDate" name="endDate" type="date" defaultValue={endDate} />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Update dates"}
        </Button>
        {state.message && (
          <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
            {state.message}
          </p>
        )}
      </form>
    )
  }

  if (serviceSlug === "daycare") {
    return (
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input id="date" name="date" type="date" defaultValue={startDate} />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Update date"}
        </Button>
        {state.message && (
          <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
            {state.message}
          </p>
        )}
      </form>
    )
  }

  return (
    <p className="text-sm text-muted-foreground">
      Dates for this service are changed by reassigning the walk slot or van run.
    </p>
  )
}
