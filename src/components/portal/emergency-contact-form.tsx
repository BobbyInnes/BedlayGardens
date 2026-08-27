"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { Label } from "@/components/ui/label"
import { updateEmergencyContact, type ActionState } from "@/app/portal/account/actions"
import { SALUTATIONS } from "@/lib/salutations"

const initialState: ActionState = { status: "idle" }

export function EmergencyContactForm({
  salutation,
  forename,
  surname,
  homePhone,
  phone,
  workPhone,
  addressLine1,
  addressLine2,
  addressCity,
  addressPostcode,
}: {
  salutation: string
  forename: string
  surname: string
  homePhone: string
  phone: string
  workPhone: string
  addressLine1: string
  addressLine2: string
  addressCity: string
  addressPostcode: string
}) {
  const [state, formAction, pending] = useActionState(updateEmergencyContact, initialState)

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div className="grid gap-4 grid-cols-[100px_1fr_1fr]">
        <div className="space-y-2">
          <Label htmlFor="emergencyContactSalutation">Title</Label>
          <select
            id="emergencyContactSalutation"
            name="emergencyContactSalutation"
            defaultValue={salutation}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          >
            <option value="">—</option>
            {SALUTATIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="emergencyContactForename">Forename</Label>
          <Input id="emergencyContactForename" name="emergencyContactForename" defaultValue={forename} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emergencyContactSurname">Surname</Label>
          <Input id="emergencyContactSurname" name="emergencyContactSurname" defaultValue={surname} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="emergencyContactHomePhone">Home Tel-No</Label>
          <PhoneInput id="emergencyContactHomePhone" name="emergencyContactHomePhone" defaultValue={homePhone} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emergencyContactPhone">Mobile Tel-No</Label>
          <PhoneInput id="emergencyContactPhone" name="emergencyContactPhone" defaultValue={phone} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emergencyContactWorkPhone">Works Tel-No</Label>
          <PhoneInput id="emergencyContactWorkPhone" name="emergencyContactWorkPhone" defaultValue={workPhone} />
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
