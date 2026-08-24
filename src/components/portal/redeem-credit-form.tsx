"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatPence } from "@/lib/format"
import { redeemCreditForPayment } from "@/app/portal/bookings/actions"

export function RedeemCreditForm({
  bookingId,
  type,
  depositPence,
  totalPence,
}: {
  bookingId: string
  type: "DEPOSIT" | "BALANCE"
  // Only passed alongside type="DEPOSIT" when there's a separate balance
  // still to come (deposit-then-balance, pre-deposit) — offers "pay it all
  // now" as well as "just the deposit" so the customer isn't forced into a
  // two-stage redemption for one booking.
  depositPence?: number
  totalPence?: number
}) {
  const [open, setOpen] = React.useState(false)
  const [code, setCode] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [payInFull, setPayInFull] = React.useState(false)

  const offerFull =
    type === "DEPOSIT" && depositPence != null && totalPence != null && totalPence > depositPence

  async function handleRedeem() {
    setPending(true)
    setMessage(null)
    const result = await redeemCreditForPayment(bookingId, offerFull && payInFull ? "FULL" : type, code)
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
      {offerFull && (
        <fieldset className="flex items-center gap-3 text-xs text-muted-foreground">
          <legend className="sr-only">Amount to redeem</legend>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name={`${bookingId}-redeem-amount`}
              checked={!payInFull}
              onChange={() => setPayInFull(false)}
            />
            Deposit only ({formatPence(depositPence!)})
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name={`${bookingId}-redeem-amount`}
              checked={payInFull}
              onChange={() => setPayInFull(true)}
            />
            Full amount ({formatPence(totalPence!)})
          </label>
        </fieldset>
      )}
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
