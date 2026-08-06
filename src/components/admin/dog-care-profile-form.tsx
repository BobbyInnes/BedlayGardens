"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateDogCareProfile } from "@/app/admin/customers/actions"

// Admin-only counterpart to the customer-facing dog profile — run type,
// temperament, and group-play approval are a kennel assessment, so they're
// deliberately absent from the customer's own view/edit form (see
// portal/dogs/actions.ts and components/portal/dog-form.tsx).
export function DogCareProfileForm({
  customerId,
  dogId,
  runType,
  temperament,
  groupPlayApproved,
}: {
  customerId: string
  dogId: string
  runType: string | null
  temperament: string | null
  groupPlayApproved: boolean
}) {
  const [editing, setEditing] = React.useState(false)
  const [runTypeValue, setRunTypeValue] = React.useState(runType ?? "")
  const [temperamentValue, setTemperamentValue] = React.useState(temperament ?? "")
  const [groupPlayValue, setGroupPlayValue] = React.useState(groupPlayApproved)
  const [pending, setPending] = React.useState(false)

  async function handleSave() {
    setPending(true)
    await updateDogCareProfile(customerId, dogId, {
      runType: runTypeValue,
      temperament: temperamentValue,
      groupPlayApproved: groupPlayValue,
    })
    setPending(false)
    setEditing(false)
  }

  function handleCancel() {
    setRunTypeValue(runType ?? "")
    setTemperamentValue(temperament ?? "")
    setGroupPlayValue(groupPlayApproved)
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-muted px-2 py-1 font-medium text-muted-foreground">
          Run type: {runType || "—"}
        </span>
        <span className="rounded-full bg-muted px-2 py-1 font-medium text-muted-foreground">
          Temperament: {temperament || "—"}
        </span>
        <span
          className={`rounded-full px-2 py-1 font-medium ${
            groupPlayApproved ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
          }`}
        >
          Group play: {groupPlayApproved ? "Approved" : "Not approved"}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-border p-2">
      <div className="space-y-1">
        <Label htmlFor={`runType-${dogId}`} className="text-xs font-normal text-muted-foreground">
          Run type
        </Label>
        <Input
          id={`runType-${dogId}`}
          value={runTypeValue}
          onChange={(e) => setRunTypeValue(e.target.value)}
          className="w-40"
          placeholder="e.g. Outdoor access"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`temperament-${dogId}`} className="text-xs font-normal text-muted-foreground">
          Temperament
        </Label>
        <Input
          id={`temperament-${dogId}`}
          value={temperamentValue}
          onChange={(e) => setTemperamentValue(e.target.value)}
          className="w-40"
          placeholder="e.g. High energy"
        />
      </div>
      <div className="flex items-center gap-1.5 pb-2">
        <input
          id={`groupPlayApproved-${dogId}`}
          type="checkbox"
          checked={groupPlayValue}
          onChange={(e) => setGroupPlayValue(e.target.checked)}
          className="size-4 rounded border-input"
        />
        <Label htmlFor={`groupPlayApproved-${dogId}`} className="text-xs font-normal">
          Approved for group play
        </Label>
      </div>
      <Button type="button" size="sm" disabled={pending} onClick={handleSave}>
        {pending ? "Saving…" : "Save"}
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={handleCancel}>
        Cancel
      </Button>
    </div>
  )
}
