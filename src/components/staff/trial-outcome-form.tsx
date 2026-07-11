"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { setTrialOutcome } from "@/app/staff/trials/actions"
import type { TrialOutcome } from "@/generated/prisma/client"

const OUTCOME_LABELS: Record<TrialOutcome, string> = {
  PASSED: "Passed",
  RETRY: "Needs another visit",
  NOT_SUITABLE: "Not suitable",
}

export function TrialOutcomeForm({ trialVisitId }: { trialVisitId: string }) {
  const [outcome, setOutcome] = React.useState<TrialOutcome>("PASSED")
  const [notes, setNotes] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSave() {
    setPending(true)
    setError(null)
    const result = await setTrialOutcome(trialVisitId, outcome, notes)
    if (result.status === "error") setError(result.message ?? "Something went wrong.")
    setPending(false)
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <Select value={outcome} onValueChange={(v) => setOutcome(v as TrialOutcome)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(OUTCOME_LABELS) as TrialOutcome[]).map((value) => (
              <SelectItem key={value} value={value}>
                {OUTCOME_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" disabled={pending} onClick={handleSave}>
          {pending ? "Saving…" : "Save outcome"}
        </Button>
      </div>
      <Textarea
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
