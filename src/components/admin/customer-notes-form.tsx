"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { updateCustomerNotes, type AdminActionState } from "@/app/admin/customers/actions"

const initialState: AdminActionState = { status: "idle" }

export function CustomerNotesForm({ customerId, notes }: { customerId: string; notes: string }) {
  const [state, formAction, pending] = useActionState(
    updateCustomerNotes.bind(null, customerId),
    initialState
  )

  return (
    <form action={formAction} className="max-w-xl space-y-3">
      <Textarea
        name="adminNotes"
        defaultValue={notes}
        rows={4}
        placeholder="Internal notes — not visible to the customer"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save notes"}
        </Button>
        {state.message && <p className="text-sm text-primary">{state.message}</p>}
      </div>
    </form>
  )
}
