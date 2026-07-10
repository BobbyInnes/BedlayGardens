"use client"

import { useActionState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createAddon, type AdminActionState } from "@/app/admin/services/actions"

const initialState: AdminActionState = { status: "idle" }

export function AddonForm({ serviceId }: { serviceId: string }) {
  const [state, formAction, pending] = useActionState(
    createAddon.bind(null, serviceId),
    initialState
  )
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.status === "idle") formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="addon-name" className="text-xs">
          Name
        </Label>
        <Input id="addon-name" name="name" className="w-44" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="addon-description" className="text-xs">
          Description
        </Label>
        <Input id="addon-description" name="description" className="w-56" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="addon-price" className="text-xs">
          Price (pence)
        </Label>
        <Input id="addon-price" name="pricePence" type="number" min={0} className="w-28" required />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
    </form>
  )
}
