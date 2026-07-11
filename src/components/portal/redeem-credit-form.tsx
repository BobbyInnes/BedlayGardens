"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { redeemCreditForPayment } from "@/app/portal/bookings/actions"

export function RedeemCreditForm({ bookingId, type }: { bookingId: string; type: "DEPOSIT" | "BALANCE" }) {
  const [open, setOpen] = React.useState(false)
  const [code, setCode] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  async function handleRedeem() {
    setPending(true)
    setMessage(null)
    const result = await redeemCreditForPayment(bookingId, type, code)
    setMessage(result.message)
    setPending(false)
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Use voucher/credit
      </Button>
    )
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Voucher code (blank = account credit)"
          className="w-56"
        />
        <Button size="sm" disabled={pending} onClick={handleRedeem}>
          {pending ? "Applying…" : "Apply"}
        </Button>
      </div>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  )
}
