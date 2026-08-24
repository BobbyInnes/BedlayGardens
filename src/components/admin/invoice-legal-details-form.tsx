"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateInvoiceLegalSettings, type AdminActionState } from "@/app/admin/content/actions"

const initialState: AdminActionState = { status: "idle" }

export function InvoiceLegalDetailsForm({
  companyRegNo,
  directors,
}: {
  companyRegNo: string
  directors: string
}) {
  const [state, formAction, pending] = useActionState(updateInvoiceLegalSettings, initialState)

  return (
    <form action={formAction} className="max-w-2xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="business_company_reg_no">Company registration number</Label>
          <Input
            id="business_company_reg_no"
            name="business_company_reg_no"
            defaultValue={companyRegNo}
            placeholder="12345678"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="business_directors">Director name(s)</Label>
          <Input
            id="business_directors"
            name="business_directors"
            defaultValue={directors}
            placeholder="Jane Smith, John Smith"
          />
        </div>
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
