"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateBusinessDetails, type AdminActionState } from "@/app/admin/content/actions"

const initialState: AdminActionState = { status: "idle" }

export function BusinessDetailsForm({
  name,
  phone,
  addressLine1,
  addressLine2,
  postcode,
}: {
  name: string
  phone: string
  addressLine1: string
  addressLine2: string
  postcode: string
}) {
  const [state, formAction, pending] = useActionState(updateBusinessDetails, initialState)

  return (
    <form action={formAction} className="max-w-2xl space-y-4">
      <div className="space-y-2">
        <Label htmlFor="business_name">Business name</Label>
        <Input
          id="business_name"
          name="business_name"
          defaultValue={name}
          placeholder="Bedlay Gardens LTD"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="business_phone">Phone number</Label>
        <Input
          id="business_phone"
          name="business_phone"
          defaultValue={phone}
          placeholder="01234 567890"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="business_address_line1">Address line 1</Label>
          <Input
            id="business_address_line1"
            name="business_address_line1"
            defaultValue={addressLine1}
            placeholder="123 Example Road"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="business_address_line2">Address line 2</Label>
          <Input
            id="business_address_line2"
            name="business_address_line2"
            defaultValue={addressLine2}
            placeholder="Glasgow"
          />
        </div>
      </div>
      <div className="space-y-2 sm:max-w-xs">
        <Label htmlFor="business_postcode">Postcode</Label>
        <Input
          id="business_postcode"
          name="business_postcode"
          defaultValue={postcode}
          placeholder="G1 1AA"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state.message && (
          <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  )
}
