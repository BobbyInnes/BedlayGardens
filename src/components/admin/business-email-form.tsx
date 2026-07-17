"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateBusinessEmail, type AdminActionState } from "@/app/admin/content/actions"

const initialState: AdminActionState = { status: "idle" }

export function BusinessEmailForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(updateBusinessEmail, initialState)

  return (
    <form action={formAction} className="flex max-w-xl flex-wrap items-end gap-3">
      <div className="grow space-y-2">
        <Label htmlFor="business_email">Business email address</Label>
        <Input
          id="business_email"
          name="business_email"
          type="email"
          placeholder="hello@example.co.uk"
          defaultValue={email}
          required
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {state.message && (
        <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
          {state.message}
        </p>
      )}
    </form>
  )
}
