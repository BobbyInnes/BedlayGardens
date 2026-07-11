"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { publishAgreement, type AdminActionState } from "@/app/admin/content/actions"

const initialState: AdminActionState = { status: "idle" }

export function PublishAgreementForm({
  currentVersion,
  currentText,
}: {
  currentVersion?: string
  currentText?: string
}) {
  const [state, formAction, pending] = useActionState(publishAgreement, initialState)

  return (
    <form action={formAction} className="max-w-xl space-y-3">
      <div className="space-y-2">
        <Label htmlFor="version">New version label</Label>
        <Input id="version" name="version" placeholder="v2" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="text">Agreement text</Label>
        <Textarea id="text" name="text" defaultValue={currentText} rows={10} required />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Publishing…" : "Publish new version"}
        </Button>
        {currentVersion && (
          <span className="text-xs text-muted-foreground">Current active version: {currentVersion}</span>
        )}
      </div>
      {state.message && (
        <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
          {state.message}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Publishing deactivates the current version — every customer will be asked to re-sign before their
        next booking.
      </p>
    </form>
  )
}
