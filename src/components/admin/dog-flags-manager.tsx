"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DOG_FLAG_LABELS, DOG_FLAG_TYPES } from "@/lib/dog-flags"
import { addDogFlag, removeDogFlag } from "@/app/admin/customers/actions"
import type { DogFlagType } from "@/generated/prisma/client"

type Flag = { id: string; type: DogFlagType; notes: string | null }

export function DogFlagsManager({
  customerId,
  dogId,
  dogName,
  flags,
}: {
  customerId: string
  dogId: string
  dogName: string
  flags: Flag[]
}) {
  const [adding, setAdding] = React.useState(false)
  const [type, setType] = React.useState<DogFlagType>("NOT_DOG_SOCIABLE")
  const [notes, setNotes] = React.useState("")
  const [pending, setPending] = React.useState(false)

  const availableTypes = DOG_FLAG_TYPES.filter((t) => !flags.some((f) => f.type === t))

  async function handleAdd() {
    setPending(true)
    await addDogFlag(customerId, dogId, type, notes)
    setNotes("")
    setAdding(false)
    setPending(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {flags.map((flag) => (
          <span
            key={flag.id}
            className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive"
          >
            {DOG_FLAG_LABELS[flag.type]}
            <button
              type="button"
              onClick={() => removeDogFlag(customerId, flag.id)}
              className="hover:underline"
              aria-label={`Remove ${DOG_FLAG_LABELS[flag.type]} flag from ${dogName}`}
            >
              ×
            </button>
          </span>
        ))}
        {availableTypes.length > 0 && !adding && (
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
            Add flag
          </Button>
        )}
      </div>

      {adding && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-border p-2">
          <Select value={type} onValueChange={(v) => setType(v as DogFlagType)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {DOG_FLAG_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-56"
          />
          <Button type="button" size="sm" disabled={pending} onClick={handleAdd}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
