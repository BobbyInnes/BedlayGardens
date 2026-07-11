"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { recordManualPayment } from "@/app/admin/bookings/actions"

export function RecordManualPaymentForm({
  bookingId,
  type,
  label,
}: {
  bookingId: string
  type: "DEPOSIT" | "BALANCE"
  label: string
}) {
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  async function handleSubmit() {
    setPending(true)
    setMessage(null)
    const result = await recordManualPayment(bookingId, type, reason)
    if (result.status === "error") {
      setMessage(result.message ?? "Something went wrong.")
    } else {
      setMessage(result.message ?? "Payment recorded.")
      setOpen(false)
    }
    setPending(false)
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Record {label} paid manually
      </Button>
    )
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">
        For payment taken outside the app (phone card payment, bank transfer, cash). This is logged
        to the audit trail.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason, e.g. bank transfer received"
          className="w-64"
        />
        <Button type="button" size="sm" disabled={pending || !reason.trim()} onClick={handleSubmit}>
          {pending ? "Recording…" : "Confirm"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {message && <p className="text-xs text-destructive">{message}</p>}
    </div>
  )
}
