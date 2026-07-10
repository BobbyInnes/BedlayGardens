"use client"

import { useActionState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createBlockedDate, type AdminActionState } from "@/app/admin/pricing/actions"

const initialState: AdminActionState = { status: "idle" }

export function BlockedDateForm({
  kennelUnits,
}: {
  kennelUnits: { id: string; name: string }[]
}) {
  const [state, formAction, pending] = useActionState(createBlockedDate, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.status === "idle") formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="blocked-date" className="text-xs">
          Date
        </Label>
        <Input id="blocked-date" name="date" type="date" className="w-40" required />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Scope</Label>
        <Select name="kennelUnitId" defaultValue="site-wide">
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="site-wide">Site-wide</SelectItem>
            {kennelUnits.map((unit) => (
              <SelectItem key={unit.id} value={unit.id}>
                {unit.name} only
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="blocked-reason" className="text-xs">
          Reason
        </Label>
        <Input id="blocked-reason" name="reason" className="w-48" placeholder="Holiday, maintenance…" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Block date"}
      </Button>
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
    </form>
  )
}
