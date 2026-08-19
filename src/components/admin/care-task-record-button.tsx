"use client"

import { useState } from "react"
import { CheckCircle2, Circle } from "lucide-react"
import { completeCareTask } from "@/app/staff/care-schedule/actions"

// Compact "Record" control for the Feeding / Medications tables on the admin
// Daily Overview — same underlying action as the staff Care Schedule's
// CareTaskItem, just laid out for a table cell instead of a card.
export function CareTaskRecordButton({
  taskId,
  completed,
  completedByName,
}: {
  taskId: string
  completed: boolean
  completedByName: string | null
}) {
  const [done, setDone] = useState(completed)
  const [pending, setPending] = useState(false)

  if (done) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
        title={completedByName ? `Completed by ${completedByName}` : undefined}
      >
        <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
        Done
      </span>
    )
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        await completeCareTask(taskId, "")
        setDone(true)
        setPending(false)
      }}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary disabled:opacity-50"
    >
      <Circle className="size-4" aria-hidden="true" />
      {pending ? "Saving…" : "Mark done"}
    </button>
  )
}
