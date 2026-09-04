"use client"

import * as React from "react"
import { updateDogBypassChecks } from "@/app/admin/dogs/actions"

// Per-dog admin override — while ticked, this dog skips that check entirely
// everywhere it's enforced (booking creation, payment success, waitlist,
// staff check-in, cron reminders, …), regardless of what's on file for it.
export function DogBypassCheckboxes({
  dogId,
  bypassVaccinationChecks,
  bypassMeetGreetChecks,
}: {
  dogId: string
  bypassVaccinationChecks: boolean
  bypassMeetGreetChecks: boolean
}) {
  const [vaccination, setVaccination] = React.useState(bypassVaccinationChecks)
  const [meetGreet, setMeetGreet] = React.useState(bypassMeetGreetChecks)
  const [pending, setPending] = React.useState<"vaccination" | "meetGreet" | null>(null)

  async function toggle(field: "bypassVaccinationChecks" | "bypassMeetGreetChecks", next: boolean) {
    const which = field === "bypassVaccinationChecks" ? "vaccination" : "meetGreet"
    setPending(which)
    if (which === "vaccination") setVaccination(next)
    else setMeetGreet(next)
    await updateDogBypassChecks(dogId, field, next)
    setPending(null)
  }

  return (
    <div className="flex flex-col gap-1 rounded-md border border-border p-2 text-xs">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={vaccination}
          disabled={pending === "vaccination"}
          onChange={(e) => toggle("bypassVaccinationChecks", e.target.checked)}
          className="size-3.5 rounded border-input"
        />
        Bypass vaccination checks
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={meetGreet}
          disabled={pending === "meetGreet"}
          onChange={(e) => toggle("bypassMeetGreetChecks", e.target.checked)}
          className="size-3.5 rounded border-input"
        />
        Bypass Meet &amp; Greet checks
      </label>
    </div>
  )
}
