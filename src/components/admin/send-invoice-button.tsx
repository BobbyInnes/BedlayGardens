"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { sendBookingInvoice } from "@/app/admin/bookings/actions"

export function SendInvoiceButton({ bookingId, label }: { bookingId: string; label: string }) {
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [isError, setIsError] = React.useState(false)

  async function handleClick() {
    setPending(true)
    setMessage(null)
    const result = await sendBookingInvoice(bookingId)
    setIsError(result.status === "error")
    setMessage(result.message ?? null)
    setPending(false)
  }

  return (
    <div className="space-y-1">
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={handleClick}>
        {pending ? "Sending…" : label}
      </Button>
      {message && (
        <p className={`text-xs ${isError ? "text-destructive" : "text-muted-foreground"}`}>{message}</p>
      )}
    </div>
  )
}
