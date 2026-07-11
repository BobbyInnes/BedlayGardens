"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { reorderWaitlistEntry, removeWaitlistEntry } from "@/app/admin/waitlist/actions"

const STATUS_LABELS = {
  WAITING: "Waiting",
  OFFERED: "Offered",
  CLAIMED: "Claimed",
  EXPIRED: "Expired",
} as const

export function WaitlistRow({
  entryId,
  position,
  customerName,
  dogName,
  status,
  canMoveUp,
  canMoveDown,
}: {
  entryId: string
  position: number
  customerName: string
  dogName: string
  status: keyof typeof STATUS_LABELS
  canMoveUp: boolean
  canMoveDown: boolean
}) {
  const [pending, setPending] = React.useState(false)

  return (
    <li className="flex items-center justify-between gap-3 p-3 text-sm">
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">#{position}</span>
        <div>
          <p className="font-medium">{dogName}</p>
          <p className="text-muted-foreground">{customerName}</p>
        </div>
        <Badge variant={status === "WAITING" ? "secondary" : status === "OFFERED" ? "default" : "outline"}>
          {STATUS_LABELS[status]}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        {status === "WAITING" && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={pending || !canMoveUp}
              onClick={async () => {
                setPending(true)
                await reorderWaitlistEntry(entryId, "up")
                setPending(false)
              }}
            >
              Up
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pending || !canMoveDown}
              onClick={async () => {
                setPending(true)
                await reorderWaitlistEntry(entryId, "down")
                setPending(false)
              }}
            >
              Down
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={async () => {
            setPending(true)
            await removeWaitlistEntry(entryId)
            setPending(false)
          }}
        >
          Remove
        </Button>
      </div>
    </li>
  )
}
