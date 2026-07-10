"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resetStaffPassword, type AdminActionState } from "@/app/admin/staff/actions"

const initialState: AdminActionState = { status: "idle" }

export function ResetPasswordForm({ staffId }: { staffId: string }) {
  const [state, formAction, pending] = useActionState(
    resetStaffPassword.bind(null, staffId),
    initialState
  )

  return (
    <form action={formAction} className="max-w-sm space-y-3">
      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <Input id="newPassword" name="newPassword" type="password" minLength={8} required />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Resetting…" : "Reset password"}
      </Button>
      {state.message && (
        <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
          {state.message}
        </p>
      )}
    </form>
  )
}
