"use client"

import { useActionState, useState } from "react"
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
  createVaccinationManual,
  type VaccinationFormState,
} from "@/app/portal/vaccinations/actions"

const initialState: VaccinationFormState = { status: "idle" }

const commonTypes = ["DHPP", "Leptospirosis", "Kennel Cough", "Rabies"]

export function VaccinationManualForm({ dogId }: { dogId: string }) {
  const [state, formAction, pending] = useActionState(createVaccinationManual, initialState)
  const [typeOption, setTypeOption] = useState("DHPP")

  return (
    <form action={formAction} className="max-w-lg space-y-5">
      <input type="hidden" name="dogId" value={dogId} />

      <div className="space-y-2">
        <Label htmlFor="type-select">Vaccine type</Label>
        <Select value={typeOption} onValueChange={setTypeOption}>
          <SelectTrigger id="type-select" className="w-full">
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
        {state.fieldErrors?.type && (
          <p className="text-sm text-destructive">{state.fieldErrors.type}</p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dateGiven">Date given</Label>
          <Input id="dateGiven" name="dateGiven" type="date" required />
          {state.fieldErrors?.dateGiven && (
            <p className="text-sm text-destructive">{state.fieldErrors.dateGiven}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="expiryDate">Expiry date</Label>
          <Input id="expiryDate" name="expiryDate" type="date" required />
          {state.fieldErrors?.expiryDate && (
            <p className="text-sm text-destructive">{state.fieldErrors.expiryDate}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="certificate">Certificate (optional)</Label>
        <Input id="certificate" name="certificate" type="file" accept="image/*,.pdf" />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add vaccination record"}
      </Button>

      {state.status === "error" && state.message && !state.fieldErrors && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
    </form>
  )
}
