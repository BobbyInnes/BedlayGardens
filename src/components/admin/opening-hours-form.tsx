"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateOpeningHours, type AdminActionState } from "@/app/admin/content/actions"

const initialState: AdminActionState = { status: "idle" }

export function OpeningHoursForm({ openingHours }: { openingHours: string }) {
  const [state, formAction, pending] = useActionState(updateOpeningHours, initialState)

  return (
    <form action={formAction} className="flex max-w-xl flex-wrap items-end gap-3">
      <div className="grow space-y-2">
        <Label htmlFor="opening_hours">Opening hours</Label>
        <Input id="opening_hours" name="opening_hours" defaultValue={openingHours} />
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
