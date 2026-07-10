"use client"

import { useActionState } from "react"
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
import type { VanRun } from "@/generated/prisma/client"
import type { AdminActionState } from "@/app/admin/van-runs/actions"

const initialState: AdminActionState = { status: "idle" }

export function VanRunForm({
  vanRun,
  staffOptions,
  action,
  submitLabel,
}: {
  vanRun?: VanRun
  staffOptions: { id: string; name: string }[]
  action: (state: AdminActionState, formData: FormData) => Promise<AdminActionState>
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="date">Date</Label>
        <Input
          id="date"
          name="date"
          type="date"
          defaultValue={vanRun ? vanRun.date.toISOString().slice(0, 10) : undefined}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Run name</Label>
        <Input id="name" name="name" defaultValue={vanRun?.name} placeholder="Morning Loop" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="startTime">Start time</Label>
        <Input
          id="startTime"
          name="startTime"
          type="time"
          defaultValue={vanRun?.startTime}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="maxDogs">Max dogs</Label>
        <Input
          id="maxDogs"
          name="maxDogs"
          type="number"
          min={1}
          defaultValue={vanRun?.maxDogs ?? 6}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="staffId">Assigned staff</Label>
        <Select name="staffId" defaultValue={vanRun?.staffId ?? "NONE"}>
          <SelectTrigger id="staffId" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">Unassigned</SelectItem>
            {staffOptions.map((staff) => (
              <SelectItem key={staff.id} value={staff.id}>
                {staff.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
      {state.status === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
    </form>
  )
}
