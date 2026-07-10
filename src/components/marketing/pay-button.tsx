"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createCheckoutSession, type CheckoutState } from "@/app/(marketing)/book/payment-actions"

const initialState: CheckoutState = { status: "error", message: "" }

export function PayButton({
  bookingId,
  type,
  label,
  size = "default",
  fullWidth = true,
}: {
  bookingId: string
  type: "DEPOSIT" | "BALANCE"
  label: string
  size?: "default" | "sm"
  fullWidth?: boolean
}) {
  const [state, formAction, pending] = useActionState(
    createCheckoutSession.bind(null, bookingId, type),
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
