"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { Label } from "@/components/ui/label"
import { registerAction, type RegisterState } from "@/app/(marketing)/register/actions"

const initialState: RegisterState = { status: "idle" }

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initialState)
  // On error, the action echoes back whatever was submitted (password
  // excluded) so a failed submission refills the form instead of blanking
  // it — remount (via `key` below) so these `defaultValue`s take effect.
  const values = state.status === "error" ? state.values : undefined

  return (
    <form key={values ? JSON.stringify(values) : "initial"} action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={values?.name} required autoComplete="name" />
        {state.fieldErrors?.name && (
          <p className="text-sm text-destructive">{state.fieldErrors.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={values?.email}
          required
          autoComplete="email"
          aria-invalid={!!state.fieldErrors?.email}
          autoFocus={!!state.fieldErrors?.email}
        />
        {state.fieldErrors?.email && (
          <p className="text-sm text-destructive">{state.fieldErrors.email}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
        {state.fieldErrors?.password && (
          <p className="text-sm text-destructive">{state.fieldErrors.password}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Telephone number</Label>
          <PhoneInput id="phone" name="phone" defaultValue={values?.phone} autoComplete="tel" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="workPhone">Work phone number</Label>
          <PhoneInput id="workPhone" name="workPhone" defaultValue={values?.workPhone} />
        </div>
      </div>
      {state.fieldErrors?.phone && (
        <p className="text-sm text-destructive">{state.fieldErrors.phone}</p>
      )}
      <p className="text-xs text-muted-foreground">Enter at least one phone number.</p>

      <div className="space-y-2">
        <Label htmlFor="addressLine1">Address line 1</Label>
        <Input
          id="addressLine1"
          name="addressLine1"
          defaultValue={values?.addressLine1}
          required
          autoComplete="address-line1"
        />
        {state.fieldErrors?.addressLine1 && (
          <p className="text-sm text-destructive">{state.fieldErrors.addressLine1}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="addressLine2">Address line 2 (optional)</Label>
        <Input
          id="addressLine2"
          name="addressLine2"
          defaultValue={values?.addressLine2}
          autoComplete="address-line2"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="addressCity">Town / city</Label>
          <Input
            id="addressCity"
            name="addressCity"
            defaultValue={values?.addressCity}
            autoComplete="address-level2"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="addressPostcode">Postcode</Label>
          <Input
            id="addressPostcode"
            name="addressPostcode"
            defaultValue={values?.addressPostcode}
            autoComplete="postal-code"
          />
        </div>
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating account…" : "Create account"}
      </Button>

      {state.status === "error" && !state.fieldErrors && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
    </form>
  )
}
