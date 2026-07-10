"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { checkOutBooking, type StaffActionState } from "@/app/staff/bookings/[bookingId]/actions"

const initialState: StaffActionState = { status: "idle" }

export function CheckOutForm({ bookingId }: { bookingId: string }) {
  const [state, formAction, pending] = useActionState(
    checkOutBooking.bind(null, bookingId),
    initialState
  )

  return (
    <form action={formAction} className="space-y-4">
      <Button type="submit" disabled={pending}>
        {pending ? "Checking out…" : "Confirm check-out"}
      </Button>
      {state.status === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
    </form>
  )
}
