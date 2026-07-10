"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { updateServiceAreaPostcodes, type AdminActionState } from "@/app/admin/van-runs/actions"

const initialState: AdminActionState = { status: "idle" }

export function ServiceAreaForm({ postcodes }: { postcodes: string }) {
  const [state, formAction, pending] = useActionState(updateServiceAreaPostcodes, initialState)

  return (
    <form action={formAction} className="max-w-xl space-y-3">
      <div className="space-y-2">
        <Label htmlFor="postcodes">Dog-walking service area (postcode outward codes)</Label>
        <Textarea
          id="postcodes"
          name="postcodes"
          defaultValue={postcodes}
          rows={2}
          placeholder="G69, G66, G64"
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated outward codes (e.g. &ldquo;G69&rdquo;). Leave blank to allow any address.
        </p>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save service area"}
      </Button>
      {state.message && (
        <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
          {state.message}
        </p>
      )}
    </form>
  )
}
