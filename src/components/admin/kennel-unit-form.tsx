"use client"

import { useActionState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createKennelUnit, type AdminActionState } from "@/app/admin/pricing/actions"

const initialState: AdminActionState = { status: "idle" }

export function KennelUnitForm() {
  const [state, formAction, pending] = useActionState(createKennelUnit, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.status === "idle") formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="unit-name" className="text-xs">
          Name
        </Label>
        <Input id="unit-name" name="name" className="w-36" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="unit-size" className="text-xs">
          Size
        </Label>
        <Input id="unit-size" name="size" className="w-28" placeholder="small" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="unit-capacity" className="text-xs">
          Dog capacity
        </Label>
        <Input id="unit-capacity" name="dogCapacity" type="number" min={1} className="w-24" required />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Add kennel"}
      </Button>
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
    </form>
  )
}
