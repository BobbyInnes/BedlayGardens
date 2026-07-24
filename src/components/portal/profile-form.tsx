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
  workPhone,
  addressLine1,
  addressLine2,
  addressCity,
  addressPostcode,
}: {
  name: string
  phone: string
  workPhone: string
  addressLine1: string
  addressLine2: string
  addressCity: string
  addressPostcode: string
}) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState)

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={name} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Telephone number</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={phone} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="workPhone">Work phone number</Label>
          <Input id="workPhone" name="workPhone" type="tel" defaultValue={workPhone} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Enter at least one phone number.</p>

      <div className="space-y-2">
        <Label htmlFor="addressLine1">Address line 1</Label>
        <Input id="addressLine1" name="addressLine1" defaultValue={addressLine1} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="addressLine2">Address line 2 (optional)</Label>
        <Input id="addressLine2" name="addressLine2" defaultValue={addressLine2} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="addressCity">Town / city</Label>
          <Input id="addressCity" name="addressCity" defaultValue={addressCity} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="addressPostcode">Postcode</Label>
          <Input id="addressPostcode" name="addressPostcode" defaultValue={addressPostcode} />
        </div>
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
