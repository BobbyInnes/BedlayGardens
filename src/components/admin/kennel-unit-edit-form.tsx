"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { KennelUnit } from "@/generated/prisma/client"
import { updateKennelUnit, type AdminActionState } from "@/app/admin/pricing/actions"

const initialState: AdminActionState = { status: "idle" }

export function KennelUnitEditForm({ unit }: { unit: KennelUnit }) {
  const [state, formAction, pending] = useActionState(
    updateKennelUnit.bind(null, unit.id),
    initialState
  )

  return (
    <form action={formAction} className="max-w-sm space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={unit.name} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="size">Size</Label>
        <Input id="size" name="size" defaultValue={unit.size} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="dogCapacity">Dog capacity</Label>
        <Input
          id="dogCapacity"
          name="dogCapacity"
          type="number"
          min={1}
          defaultValue={unit.dogCapacity}
          required
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
    </form>
  )
}
