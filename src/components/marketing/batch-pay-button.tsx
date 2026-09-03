"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createBatchCheckoutSession, type CheckoutState } from "@/app/(marketing)/book/payment-actions"

const initialState: CheckoutState = { status: "error", message: "" }

// Pays several same-batch Day Care dates in one Checkout session — see
// createBatchCheckoutSession. Same shape as PayButton, just bound to a list
// of booking ids instead of one.
export function BatchPayButton({
  bookingIds,
  type,
  label,
  size = "default",
  fullWidth = true,
}: {
  bookingIds: string[]
  type: "DEPOSIT" | "FULL"
  label: string
  size?: "default" | "sm"
  fullWidth?: boolean
}) {
  const [state, formAction, pending] = useActionState(
    createBatchCheckoutSession.bind(null, bookingIds, type),
    initialState
  )

  return (
    <form action={formAction} className={cn(fullWidth && "w-full")}>
      <Button type="submit" size={size} className={cn(fullWidth && "w-full")} disabled={pending}>
        {pending ? "Redirecting…" : label}
      </Button>
      {state.message && <p className="mt-2 text-sm text-destructive">{state.message}</p>}
    </form>
  )
}
