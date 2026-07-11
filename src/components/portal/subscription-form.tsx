"use client"

import * as React from "react"
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
import { createSubscription } from "@/app/portal/subscriptions/actions"

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
]

export function SubscriptionForm({ dogs }: { dogs: { id: string; name: string }[] }) {
  const [serviceSlug, setServiceSlug] = React.useState<"daycare" | "dog-walking">("daycare")
  const [dogId, setDogId] = React.useState(dogs[0]?.id ?? "")
  const [weekdays, setWeekdays] = React.useState<number[]>([])
  const [slot, setSlot] = React.useState("09:00")
  const [submitting, setSubmitting] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  function toggleWeekday(day: number) {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  async function handleSubmit() {
    setSubmitting(true)
    setMessage(null)
    try {
      const result = await createSubscription({ serviceSlug, dogId, weekdays, slot })
      if (result?.status === "error") setMessage(result.message ?? "Something went wrong.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl space-y-4 rounded-lg border border-border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Service</Label>
          <Select value={serviceSlug} onValueChange={(v) => setServiceSlug(v as typeof serviceSlug)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daycare">Daycare</SelectItem>
              <SelectItem value="dog-walking">Dog Walking</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Dog</Label>
          <Select value={dogId} onValueChange={setDogId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a dog" />
            </SelectTrigger>
            <SelectContent>
              {dogs.map((dog) => (
                <SelectItem key={dog.id} value={dog.id}>
                  {dog.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Days</Label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleWeekday(d.value)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                weekdays.includes(d.value) ? "border-primary bg-primary/10" : "border-border"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="slot">Preferred time</Label>
        <Input id="slot" type="time" value={slot} onChange={(e) => setSlot(e.target.value)} />
      </div>

      <p className="text-xs text-muted-foreground">
        {serviceSlug === "daycare"
          ? "We'll automatically create your daycare booking each week, a week ahead of time."
          : "We'll be in touch to confirm van run availability for your chosen days."}
      </p>

      <Button onClick={handleSubmit} disabled={submitting || !dogId || weekdays.length === 0}>
        {submitting ? "Setting up…" : "Start subscription"}
      </Button>
      {message && <p className="text-sm text-destructive">{message}</p>}
    </div>
  )
}
