"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  updateNotificationPreference,
  type NotificationActionState,
} from "@/app/portal/account/actions"
import type { NotificationChannel } from "@/generated/prisma/client"

const initialState: NotificationActionState = { status: "idle" }

const OPTIONS: { value: NotificationChannel; label: string }[] = [
  { value: "EMAIL", label: "Email only" },
  { value: "SMS", label: "SMS only" },
  { value: "BOTH", label: "Email and SMS" },
  { value: "NONE", label: "None" },
]

export function NotificationPreferenceForm({ channel }: { channel: NotificationChannel }) {
  const [state, formAction, pending] = useActionState(updateNotificationPreference, initialState)
  // React resets a <form>'s fields after a Server Action completes
  // successfully. For a *controlled* radio that already held the
  // just-submitted value, that native reset silently desyncs the DOM from
  // React's own state — no further re-render fires because the state value
  // isn't "changing", so the desync is never repainted. Remounting via `key`
  // whenever the confirmed-good value changes sidesteps this: a fresh mount
  // (uncontrolled, via defaultChecked) always paints correctly regardless of
  // what the native reset did to the old DOM. Same trick as the dog form's
  // error-refill remount.
  const effectiveChannel = state.status === "success" && state.channel ? state.channel : channel

  return (
    <form key={effectiveChannel} action={formAction} className="space-y-3">
      <div className="flex flex-col gap-2">
        {OPTIONS.map((option) => (
          <div key={option.value} className="flex items-center gap-2">
            <input
              type="radio"
              id={`channel-${option.value}`}
              name="channel"
              value={option.value}
              defaultChecked={effectiveChannel === option.value}
              className="size-4 border-input"
            />
            <Label htmlFor={`channel-${option.value}`} className="font-normal">
              {option.label}
            </Label>
          </div>
        ))}
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {state.message && (
        <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
          {state.message}
        </p>
      )}
    </form>
  )
}
