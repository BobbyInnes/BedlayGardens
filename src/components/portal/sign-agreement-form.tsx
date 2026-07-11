"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signAgreement, type SignAgreementState } from "@/app/portal/agreement/actions"

const initialState: SignAgreementState = { status: "idle" }

export function SignAgreementForm({
  agreementId,
  returnTo,
}: {
  agreementId: string
  returnTo?: string
}) {
  const [state, formAction, pending] = useActionState(signAgreement, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="agreementId" value={agreementId} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

      <div className="space-y-2">
        <Label htmlFor="signedName">Type your full name to sign</Label>
        <Input id="signedName" name="signedName" required />
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="agree" className="mt-0.5 size-4 rounded border-input" required />
        <span>I have read and agree to the boarding agreement above.</span>
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? "Signing…" : "Sign agreement"}
      </Button>
      {state.status === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
    </form>
  )
}
