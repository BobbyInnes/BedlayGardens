"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { checkInBooking, type StaffActionState } from "@/app/staff/bookings/[bookingId]/actions"

const initialState: StaffActionState = { status: "idle" }

type DogGateInfo = { dogId: string; dogName: string; missingTypes: string[] }

export function CheckInForm({
  bookingId,
  isBoarding,
  currentKennelUnitId,
  kennelUnits,
  gateOk,
  perDog,
}: {
  bookingId: string
  isBoarding: boolean
  currentKennelUnitId: string | null
  kennelUnits: { id: string; name: string; size: string; dogCapacity: number }[]
  gateOk: boolean
  perDog: DogGateInfo[]
}) {
  const [state, formAction, pending] = useActionState(
    checkInBooking.bind(null, bookingId),
    initialState
  )

  return (
    <form action={formAction} className="max-w-lg space-y-6">
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Vaccination status</h2>
        <ul className="space-y-1 text-sm">
          {perDog.map((dog) => (
            <li key={dog.dogId}>
              {dog.dogName}:{" "}
              {dog.missingTypes.length === 0 ? (
                <span className="text-primary">OK</span>
              ) : (
                <span className="text-destructive">Missing/expired: {dog.missingTypes.join(", ")}</span>
              )}
            </li>
          ))}
        </ul>
        {!gateOk && (
          <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <Label htmlFor="overrideReason" className="text-sm">
              Override reason (required to check in with missing/expired vaccinations)
            </Label>
            <Textarea id="overrideReason" name="overrideReason" rows={2} />
          </div>
        )}
      </div>

      {isBoarding && (
        <div className="space-y-2">
          <Label htmlFor="kennelUnitId">Kennel</Label>
          <Select name="kennelUnitId" defaultValue={currentKennelUnitId ?? undefined}>
            <SelectTrigger id="kennelUnitId" className="w-full">
              <SelectValue placeholder="Select kennel" />
            </SelectTrigger>
            <SelectContent>
              {kennelUnits.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.name} ({unit.size}, up to {unit.dogCapacity})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          id="belongingsConfirmed"
          name="belongingsConfirmed"
          type="checkbox"
          className="size-4 rounded border-input"
        />
        <Label htmlFor="belongingsConfirmed" className="font-normal">
          Belongings confirmed with owner
        </Label>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Checking in…" : "Check in"}
      </Button>

      {state.status === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
    </form>
  )
}
