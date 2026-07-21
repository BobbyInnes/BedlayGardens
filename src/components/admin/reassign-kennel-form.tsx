"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { reassignKennel } from "@/app/admin/bookings/actions"

type KennelOption = { id: string; name: string; dogCapacity: number }

export function ReassignKennelForm({
  bookingId,
  currentKennelUnitId,
  kennelUnits,
}: {
  bookingId: string
  currentKennelUnitId: string
  kennelUnits: KennelOption[]
}) {
  const [selected, setSelected] = React.useState(currentKennelUnitId)
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<{ text: string; error: boolean } | null>(null)

  async function handleSubmit() {
    setPending(true)
    setMessage(null)
    const result = await reassignKennel(bookingId, selected)
    setMessage({ text: result.message ?? "", error: result.status === "error" })
    setPending(false)
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {kennelUnits.map((unit) => (
            <SelectItem key={unit.id} value={unit.id}>
              {unit.name} (cap {unit.dogCapacity})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        disabled={pending || selected === currentKennelUnitId}
        onClick={handleSubmit}
      >
        {pending ? "Moving…" : "Reassign accommodation"}
      </Button>
      {message && (
        <p className={message.error ? "text-sm text-destructive" : "text-sm text-primary"}>
          {message.text}
        </p>
      )}
    </div>
  )
}
