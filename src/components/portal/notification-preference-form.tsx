"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateNotificationPreference, type ActionState } from "@/app/portal/account/actions"

const initialState: ActionState = { status: "idle" }

export function NotificationPreferenceForm({ channel }: { channel: "EMAIL" | "SMS" | "BOTH" }) {
  const [state, formAction, pending] = useActionState(updateNotificationPreference, initialState)

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <Select name="channel" defaultValue={channel}>
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="EMAIL">Email only</SelectItem>
          <SelectItem value="SMS">SMS only</SelectItem>
          <SelectItem value="BOTH">Email and SMS</SelectItem>
        </SelectContent>
      </Select>
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
