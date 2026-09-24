"use client"

import * as React from "react"
import { useActionState } from "react"
import { Badge } from "@/components/ui/badge"
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

type BookingDog = { dogId: string; dogName: string }
type Incident = {
  id: string
  dogName: string
  severity: string
  description: string
  ownerInformed: boolean
  reportedByName: string
  createdAt: string
}

export function BookingIncidentsSection({
  bookingId,
  dogs,
  incidents,
}: {
  bookingId: string
  dogs: BookingDog[]
  incidents: Incident[]
}) {
  const [state, formAction, pending] = useActionState(createIncident, initialState)
  const [selectedDogId, setSelectedDogId] = React.useState(dogs[0]?.dogId ?? "")
  const [showForm, setShowForm] = React.useState(false)

  const severityVariant = (severity: string) =>
    severity === "High" ? "destructive" : severity === "Medium" ? "secondary" : "outline"

  return (
    <div className="space-y-4">
      {incidents.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {incidents.map((incident) => (
            <li key={incident.id} className="space-y-1 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{incident.dogName}</span>
                <Badge variant={severityVariant(incident.severity)}>{incident.severity}</Badge>
              </div>
              <p className="text-muted-foreground">{incident.description}</p>
              <p className="text-xs text-muted-foreground">
                {incident.reportedByName} — {incident.createdAt}
                {" — "}
                Owner informed: {incident.ownerInformed ? "Yes" : "No"}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No incidents on file.</p>
      )}

      {showForm ? (
        <form action={formAction} className="max-w-lg space-y-4">
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="dogId" value={selectedDogId} />

          {dogs.length > 1 && (
            <div className="space-y-2">
              <Label>Dog</Label>
              <Select value={selectedDogId} onValueChange={setSelectedDogId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dogs.map((dog) => (
                    <SelectItem key={dog.dogId} value={dog.dogId}>
                      {dog.dogName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="ownerInformed" className="size-4 rounded border-input" />
            Owner informed
          </label>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Logging…" : "Log incident"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
          {state.status === "error" && (
            <p className="text-sm text-destructive" role="alert">
              {state.message}
            </p>
          )}
        </form>
      ) : (
        <Button type="button" variant="outline" onClick={() => setShowForm(true)}>
          + Add incident
        </Button>
      )}
    </div>
  )
}
