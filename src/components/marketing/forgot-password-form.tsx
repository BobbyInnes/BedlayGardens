"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requestPasswordReset, type ForgotPasswordState } from "@/app/(marketing)/forgot-password/actions"

const initialState: ForgotPasswordState = { status: "idle" }

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState)

  if (state.status === "success") {
    return (
      <p className="rounded-md border border-border bg-muted/50 p-4 text-sm text-foreground" role="status">
        {state.message}
      </p>
    )
  }

  return (
    <form action={formAction} className="space-y-5" autoComplete="off">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="off" />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      {state.status === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
    </form>
  )
}
