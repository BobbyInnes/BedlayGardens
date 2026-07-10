"use client"

import * as React from "react"
import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createIncident, type IncidentFormState } from "@/app/staff/incidents/actions"

const initialState: IncidentFormState = { status: "idle" }

type InHouseDog = { dogId: string; dogName: string; bookingId: string; customerName: string }

export function IncidentForm({ inHouseDogs }: { inHouseDogs: InHouseDog[] }) {
  const [state, formAction, pending] = useActionState(createIncident, initialState)
  const [selectedDogId, setSelectedDogId] = React.useState(inHouseDogs[0]?.dogId ?? "")
  const selected = inHouseDogs.find((d) => d.dogId === selectedDogId)

  if (inHouseDogs.length === 0) {
    return <p className="text-sm text-muted-foreground">No dogs currently in-house to log against.</p>
  }

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <input type="hidden" name="bookingId" value={selected?.bookingId ?? ""} />
      <input type="hidden" name="dogId" value={selectedDogId} />

      <div className="space-y-2">
        <Label>Dog</Label>
        <Select value={selectedDogId} onValueChange={setSelectedDogId}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {inHouseDogs.map((dog) => (
              <SelectItem key={dog.dogId} value={dog.dogId}>
                {dog.dogName} — {dog.customerName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Severity</Label>
        <Select name="severity" defaultValue="Low">
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="High">High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} required />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Logging…" : "Log incident"}
      </Button>
      {state.status === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
    </form>
  )
}
