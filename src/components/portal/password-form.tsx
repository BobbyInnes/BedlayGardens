"use client"

import { useActionState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { changePassword, type ActionState } from "@/app/portal/account/actions"
import { useFormDirty } from "@/hooks/use-form-dirty"

const initialState: ActionState = { status: "idle" }

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState)
  const { formRef, dirty, handleChange, markClean } = useFormDirty()

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset()
      markClean()
    }
  }, [state.status, formRef, markClean])

  return (
    <form ref={formRef} action={formAction} onChange={handleChange} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <Input id="newPassword" name="newPassword" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <Button type="submit" disabled={pending || !dirty}>
        {pending ? "Updating…" : "Update password"}
      </Button>
      {state.message && (
        <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
          {state.message}
        </p>
      )}
    </form>
  )
}
