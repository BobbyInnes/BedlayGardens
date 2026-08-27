"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { Label } from "@/components/ui/label"
import { updateProfile, type ActionState } from "@/app/portal/account/actions"
import { SALUTATIONS } from "@/lib/salutations"

const initialState: ActionState = { status: "idle" }

export function ProfileForm({
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
  const [state, formAction, pending] = useActionState(updateProfile, initialState)

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div className="grid gap-4 grid-cols-[100px_1fr_1fr]">
        <div className="space-y-2">
          <Label htmlFor="salutation">Title</Label>
          <select
            id="salutation"
            name="salutation"
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
          <Label htmlFor="forename">Forename</Label>
          <Input id="forename" name="forename" defaultValue={forename} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="surname">Surname</Label>
          <Input id="surname" name="surname" defaultValue={surname} required />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="homePhone">Home Tel-No</Label>
          <PhoneInput id="homePhone" name="homePhone" defaultValue={homePhone} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Mobile Tel-No</Label>
          <PhoneInput id="phone" name="phone" defaultValue={phone} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="workPhone">Works Tel-No</Label>
          <PhoneInput id="workPhone" name="workPhone" defaultValue={workPhone} />
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
