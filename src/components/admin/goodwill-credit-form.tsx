"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { issueGoodwillCredit, type AdminActionState } from "@/app/admin/customers/actions"

const initialState: AdminActionState = { status: "idle" }

export function GoodwillCreditForm({ customerId }: { customerId: string }) {
  const [state, formAction, pending] = useActionState(issueGoodwillCredit.bind(null, customerId), initialState)

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="amountPounds" className="text-xs">
          Amount (£)
        </Label>
        <Input id="amountPounds" name="amountPounds" type="number" min={0.01} step="0.01" className="w-28" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="reason" className="text-xs">
          Reason
        </Label>
        <Input id="reason" name="reason" className="w-56" placeholder="Apology for..." />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Issuing…" : "Issue credit"}
      </Button>
      {state.message && (
        <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
          {state.message}
        </p>
      )}
    </form>
  )
}
