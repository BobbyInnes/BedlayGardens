"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { Label } from "@/components/ui/label"
import { updateEmergencyContact, type ActionState } from "@/app/portal/account/actions"

const initialState: ActionState = { status: "idle" }

export function EmergencyContactForm({
  name,
  phone,
  addressLine1,
  addressLine2,
  addressCity,
  addressPostcode,
}: {
  name: string
  phone: string
  addressLine1: string
  addressLine2: string
  addressCity: string
  addressPostcode: string
}) {
  const [state, formAction, pending] = useActionState(updateEmergencyContact, initialState)

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="emergencyContactName">Name</Label>
          <Input id="emergencyContactName" name="emergencyContactName" defaultValue={name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emergencyContactPhone">Phone number</Label>
          <PhoneInput id="emergencyContactPhone" name="emergencyContactPhone" defaultValue={phone} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="emergencyContactAddressLine1">Address line 1</Label>
        <Input
          id="emergencyContactAddressLine1"
          name="emergencyContactAddressLine1"
          defaultValue={addressLine1}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="emergencyContactAddressLine2">Address line 2 (optional)</Label>
        <Input
          id="emergencyContactAddressLine2"
          name="emergencyContactAddressLine2"
          defaultValue={addressLine2}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="emergencyContactCity">Town / city</Label>
          <Input id="emergencyContactCity" name="emergencyContactCity" defaultValue={addressCity} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emergencyContactPostcode">Postcode</Label>
          <Input
            id="emergencyContactPostcode"
            name="emergencyContactPostcode"
            defaultValue={addressPostcode}
          />
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
