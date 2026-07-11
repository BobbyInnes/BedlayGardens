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
import { createPupdate, type StaffActionState } from "@/app/staff/pupdates/actions"

const initialState: StaffActionState = { status: "idle" }

export function PupdateForm({
  dogs,
}: {
  dogs: { bookingId: string; dogId: string; dogName: string; customerName: string }[]
}) {
  const [state, formAction, pending] = useActionState(createPupdate, initialState)

  return (
    <form action={formAction} className="max-w-xl space-y-3">
      <div className="space-y-2">
        <Label htmlFor="dog">Dog</Label>
        <Select name="dogAndBooking" required>
          <SelectTrigger id="dog" className="w-full">
            <SelectValue placeholder="Choose a dog" />
          </SelectTrigger>
          <SelectContent>
            {dogs.map((d) => (
              <SelectItem key={`${d.bookingId}-${d.dogId}`} value={`${d.bookingId}:${d.dogId}`}>
                {d.dogName} — {d.customerName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="file">Photo or video</Label>
        <input
          id="file"
          name="file"
          type="file"
          accept="image/*,video/*"
          className="block w-full text-sm"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Note (optional)</Label>
        <Textarea id="note" name="note" rows={2} />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Posting…" : "Post pupdate"}
      </Button>

      {state.message && (
        <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
          {state.message}
        </p>
      )}
    </form>
  )
}
