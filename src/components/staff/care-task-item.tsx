"use client"

import * as React from "react"
import { CheckCircle2, Circle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { completeCareTask } from "@/app/staff/care-schedule/actions"

export function CareTaskItem({
  taskId,
  type,
  description,
  completed,
  completedByName,
  notes,
}: {
  taskId: string
  type: string
  description: string
  completed: boolean
  completedByName: string | null
  notes: string | null
}) {
  const [noteValue, setNoteValue] = React.useState(notes ?? "")
  const [pending, setPending] = React.useState(false)
  const [done, setDone] = React.useState(completed)

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm">
      {done ? (
        <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden="true" />
      ) : (
        <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <div className="min-w-40 flex-1">
        <p className="font-medium capitalize">{type.toLowerCase()}</p>
        <p className="text-muted-foreground">{description}</p>
        {done && completedByName && (
          <p className="text-xs text-muted-foreground">Completed by {completedByName}</p>
        )}
      </div>
      <Input
        value={noteValue}
        onChange={(e) => setNoteValue(e.target.value)}
        placeholder="Notes (optional)"
        className="max-w-48"
        disabled={done}
      />
      <Button
        type="button"
        size="sm"
        variant={done ? "outline" : "default"}
        disabled={pending || done}
        onClick={async () => {
          setPending(true)
          await completeCareTask(taskId, noteValue)
          setDone(true)
          setPending(false)
        }}
      >
        {done ? "Done" : pending ? "Saving…" : "Mark done"}
      </Button>
    </li>
  )
}
