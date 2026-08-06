"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateVaccinationReviewEmail, type AdminActionState } from "@/app/admin/content/actions"

const initialState: AdminActionState = { status: "idle" }

export function VaccinationReviewEmailForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(updateVaccinationReviewEmail, initialState)

  return (
    <form action={formAction} className="flex max-w-xl flex-wrap items-end gap-3">
      <div className="grow space-y-2">
        <Label htmlFor="vaccination_review_email">Notification email</Label>
        <Input
          id="vaccination_review_email"
          name="vaccination_review_email"
          type="email"
          placeholder="e.g. vaccinations@example.co.uk"
          defaultValue={email}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {state.message && (
        <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
          {state.message}
        </p>
      )}
    </form>
  )
}
