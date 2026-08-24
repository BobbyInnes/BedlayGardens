"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { Label } from "@/components/ui/label"
import { updateVetPractice, type ActionState } from "@/app/portal/account/actions"

const initialState: ActionState = { status: "idle" }

export function VetPracticeForm({
  practiceName,
  practiceEmail,
  consultantName,
  phone,
  addressLine1,
  addressLine2,
  addressCity,
  addressPostcode,
}: {
  practiceName: string
  practiceEmail: string
  consultantName: string
  phone: string
  addressLine1: string
  addressLine2: string
  addressCity: string
  addressPostcode: string
}) {
  const [state, formAction, pending] = useActionState(updateVetPractice, initialState)

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="vetPracticeName">Practice name</Label>
          <Input id="vetPracticeName" name="vetPracticeName" defaultValue={practiceName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vetEmail">Practice email</Label>
          <Input id="vetEmail" name="vetEmail" type="email" defaultValue={practiceEmail} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vetName">Consultant&apos;s name</Label>
          <Input id="vetName" name="vetName" defaultValue={consultantName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vetPhone">Phone</Label>
          <PhoneInput id="vetPhone" name="vetPhone" defaultValue={phone} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="vetAddressLine1">Address line 1</Label>
        <Input id="vetAddressLine1" name="vetAddressLine1" defaultValue={addressLine1} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="vetAddressLine2">Address line 2 (optional)</Label>
        <Input id="vetAddressLine2" name="vetAddressLine2" defaultValue={addressLine2} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="vetCity">Town / city</Label>
          <Input id="vetCity" name="vetCity" defaultValue={addressCity} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vetPostcode">Postcode</Label>
          <Input id="vetPostcode" name="vetPostcode" defaultValue={addressPostcode} />
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
