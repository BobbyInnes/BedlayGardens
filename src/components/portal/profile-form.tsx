"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateProfile, type ActionState } from "@/app/portal/account/actions"

const initialState: ActionState = { status: "idle" }

export function ProfileForm({
  name,
  phone,
  address,
}: {
  name: string
  phone: string
  address: string
}) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState)

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={name} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" type="tel" defaultValue={phone} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" defaultValue={address} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
      {state.message && (
        <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
          {state.message}
        </p>
      )}
    </form>
  )
}
