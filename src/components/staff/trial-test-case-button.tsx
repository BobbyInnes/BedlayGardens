"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { approveTrialAsTestCase } from "@/app/staff/trials/actions"

// Admin-only escape hatch next to the "can't approve before the date" error
// on the Meet & Greet Review page — for a booking that only exists to test
// the flow, not a real visit. Fixed outcome (Passed) and notes, no other
// input, so it can't be mistaken for a real early approval.
export function TrialTestCaseButton({ trialVisitId }: { trialVisitId: string }) {
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleClick() {
    setPending(true)
    setError(null)
    const result = await approveTrialAsTestCase(trialVisitId)
    if (result.status === "error") setError(result.message ?? "Something went wrong.")
    setPending(false)
  }

  return (
    <div className="space-y-1">
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={handleClick}>
        {pending ? "Approving…" : "Mark as test case & approve"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
