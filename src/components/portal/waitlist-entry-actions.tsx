"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { claimWaitlistOffer, cancelWaitlistEntry } from "@/app/portal/waitlist/actions"

export function WaitlistEntryActions({ entryId, offered }: { entryId: string; offered: boolean }) {
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  async function handleClaim() {
    setPending(true)
    const result = await claimWaitlistOffer(entryId)
    setMessage(result.message ?? null)
    setPending(false)
  }

  async function handleCancel() {
    setPending(true)
    await cancelWaitlistEntry(entryId)
    setPending(false)
  }

  return (
    <div className="flex items-center gap-2">
      {offered && (
        <Button size="sm" disabled={pending} onClick={handleClaim}>
          {pending ? "Booking…" : "Claim"}
        </Button>
      )}
      <Button variant="outline" size="sm" disabled={pending} onClick={handleCancel}>
        Leave waitlist
      </Button>
      {message && <p className="text-xs text-destructive">{message}</p>}
    </div>
  )
}
