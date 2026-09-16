"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { emailContactDetails, type ActionState } from "@/app/portal/account/actions"

const initialState: ActionState = { status: "idle" }

export function EmailContactDetailsButton() {
  const [state, formAction, pending] = useActionState(emailContactDetails, initialState)

  return (
    <form action={formAction} className="space-y-2">
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Email contact details"}
      </Button>
      {state.message && (
        <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
          {state.message}
        </p>
      )}
    </form>
  )
}
