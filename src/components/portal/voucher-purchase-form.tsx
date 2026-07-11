"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { purchaseVoucher } from "@/app/portal/vouchers/actions"

const PRESET_AMOUNTS_PENCE = [2500, 5000, 10000]

export function VoucherPurchaseForm() {
  const [amountPence, setAmountPence] = React.useState(PRESET_AMOUNTS_PENCE[0])
  const [custom, setCustom] = React.useState("")
  const [recipientEmail, setRecipientEmail] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  async function handleSubmit() {
    setSubmitting(true)
    setMessage(null)
    try {
      const finalAmount = custom ? Math.round(Number(custom) * 100) : amountPence
      const result = await purchaseVoucher({ amountPence: finalAmount, recipientEmail })
      if (result?.status === "error") setMessage(result.message ?? "Something went wrong.")
      else if (result?.message) setMessage(result.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-md space-y-4 rounded-lg border border-border p-4">
      <div className="flex flex-wrap gap-2">
        {PRESET_AMOUNTS_PENCE.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => {
              setAmountPence(amount)
              setCustom("")
            }}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              !custom && amountPence === amount ? "border-primary bg-primary/10" : "border-border"
            }`}
          >
            £{amount / 100}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="custom">Or custom amount (£)</Label>
        <Input id="custom" type="number" min={5} step="1" value={custom} onChange={(e) => setCustom(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="recipientEmail">Recipient email (optional — defaults to you)</Label>
        <Input
          id="recipientEmail"
          type="email"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
        />
      </div>
      <Button onClick={handleSubmit} disabled={submitting}>
        {submitting ? "Processing…" : "Buy gift voucher"}
      </Button>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  )
}
