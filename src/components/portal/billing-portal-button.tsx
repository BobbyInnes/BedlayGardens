"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { openBillingPortal, type ActionState } from "@/app/portal/account/actions"

const initialState: ActionState = { status: "idle" }

export function BillingPortalButton() {
  const [state, formAction, pending] = useActionState(openBillingPortal, initialState)

  return (
    <form action={formAction}>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Opening…" : "Manage saved cards"}
      </Button>
      {state.status === "error" && (
        <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
      )}
    </form>
  )
}
