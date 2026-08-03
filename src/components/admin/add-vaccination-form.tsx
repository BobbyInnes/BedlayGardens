"use client"

import * as React from "react"
import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  addVaccinationRecordManually,
  type AdminActionState,
} from "@/app/admin/customers/actions"

const initialState: AdminActionState = { status: "idle" }
const commonTypes = ["DHPP", "Leptospirosis", "Kennel Cough", "Rabies"]

export function AddVaccinationForm({
  customerId,
  dogId,
}: {
  customerId: string
  dogId: string
}) {
  const [adding, setAdding] = React.useState(false)
  const [typeOption, setTypeOption] = React.useState("DHPP")
  const action = addVaccinationRecordManually.bind(null, customerId, dogId)
  const [state, formAction, pending] = useActionState(action, initialState)

  if (!adding) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
        Add vaccination
      </Button>
    )
  }

  return (
    <form action={formAction} className="w-full space-y-3 rounded-md border border-border p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor={`type-${dogId}`}>Vaccine type</Label>
          <Select value={typeOption} onValueChange={setTypeOption}>
            <SelectTrigger id={`type-${dogId}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {commonTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          {typeOption === "Other" ? (
            <Input name="type" placeholder="Enter vaccine type" required />
          ) : (
            <input type="hidden" name="type" value={typeOption} />
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor={`dateGiven-${dogId}`}>Date given</Label>
          <Input id={`dateGiven-${dogId}`} name="dateGiven" type="date" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`expiryDate-${dogId}`}>Expiry date</Label>
          <Input id={`expiryDate-${dogId}`} name="expiryDate" type="date" required />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`certificate-${dogId}`}>Certificate (optional)</Label>
        <Input id={`certificate-${dogId}`} name="certificate" type="file" accept="image/*,.pdf" />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(false)}>
          Cancel
        </Button>
      </div>

      {state.status === "error" && state.message && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
      {state.status === "idle" && state.message && (
        <p className="text-sm text-muted-foreground">{state.message}</p>
      )}
    </form>
  )
}
