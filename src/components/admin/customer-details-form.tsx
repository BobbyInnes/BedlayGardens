"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { Label } from "@/components/ui/label"
import { updateCustomerContactDetails, type AdminActionState } from "@/app/admin/customers/actions"

const initialState: AdminActionState = { status: "idle" }

export function CustomerDetailsForm({
  customerId,
  name,
  email,
  phone,
  workPhone,
  addressLine1,
  addressLine2,
  addressCity,
  addressPostcode,
}: {
  customerId: string
  name: string
  email: string
  phone: string
  workPhone: string
  addressLine1: string
  addressLine2: string
  addressCity: string
  addressPostcode: string
}) {
  const boundAction = updateCustomerContactDetails.bind(null, customerId)
  const [state, formAction, pending] = useActionState(boundAction, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={name} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Telephone number</Label>
          <PhoneInput id="phone" name="phone" defaultValue={phone} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="workPhone">Work phone number</Label>
          <PhoneInput id="workPhone" name="workPhone" defaultValue={workPhone} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="addressLine1">Address line 1</Label>
        <Input id="addressLine1" name="addressLine1" defaultValue={addressLine1} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="addressLine2">Address line 2</Label>
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
        {pending ? "Saving…" : "Update details"}
      </Button>
      {state.message && (
        <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
          {state.message}
        </p>
      )}
    </form>
  )
}
