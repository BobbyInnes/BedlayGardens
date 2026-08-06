"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateVaccinationReviewEmail, type AdminActionState } from "@/app/admin/content/actions"

const initialState: AdminActionState = { status: "idle" }

export function VaccinationReviewEmailForm({
  email,
  immediate,
}: {
  email: string
  immediate: boolean
}) {
  const [state, formAction, pending] = useActionState(updateVaccinationReviewEmail, initialState)

  return (
    <form action={formAction} className="max-w-xl space-y-3">
      <div className="flex flex-wrap items-end gap-3">
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
      </div>
      <div className="flex items-center gap-2">
        <input
          id="vaccination_review_immediate"
          name="vaccination_review_immediate"
          type="checkbox"
          defaultChecked={immediate}
          className="size-4 rounded border-input"
        />
        <Label htmlFor="vaccination_review_immediate" className="font-normal">
          Send immediately when a certificate is uploaded, instead of waiting for the daily digest
        </Label>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state.message && (
          <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  )
}
