"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
} from "@/app/portal/subscriptions/actions"

export function SubscriptionActions({
  subscriptionId,
  status,
}: {
  subscriptionId: string
  status: string
}) {
  const [pausing, setPausing] = React.useState(false)
  const [pauseDate, setPauseDate] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  async function handlePause() {
    setPending(true)
    const result = await pauseSubscription(subscriptionId, pauseDate)
    setMessage(result.message ?? null)
    if (result.status === "idle") setPausing(false)
    setPending(false)
  }

  async function handleResume() {
    setPending(true)
    await resumeSubscription(subscriptionId)
    setPending(false)
  }

  async function handleCancel() {
    setPending(true)
    await cancelSubscription(subscriptionId)
    setPending(false)
  }

  if (status === "PAUSED") {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={pending} onClick={handleResume}>
          Resume
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {pausing ? (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={pauseDate}
            onChange={(e) => setPauseDate(e.target.value)}
            className="w-40"
          />
          <Button size="sm" disabled={pending || !pauseDate} onClick={handlePause}>
            Confirm pause
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPausing(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setPausing(true)}>
            Pause until…
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      )}
      {message && <p className="text-xs text-destructive">{message}</p>}
    </div>
  )
}
