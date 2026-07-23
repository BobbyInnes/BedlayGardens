"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { publishAgreement, type AdminActionState } from "@/app/admin/content/actions"

const initialState: AdminActionState = { status: "idle" }

export function PublishAgreementForm({
  currentVersion,
  activeSectionCount,
}: {
  currentVersion?: string
  activeSectionCount: number
}) {
  const [state, formAction, pending] = useActionState(publishAgreement, initialState)

  return (
    <form action={formAction} className="max-w-xl space-y-3">
      <p className="text-sm text-muted-foreground">
        Publishing assembles the {activeSectionCount} active section{activeSectionCount === 1 ? "" : "s"}{" "}
        below, in order, into a new version.
      </p>
      <div className="space-y-2">
        <Label htmlFor="version">New version label</Label>
        <Input id="version" name="version" placeholder="v2" required />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || activeSectionCount === 0}>
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
