"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { updateVanRunStopStatus } from "@/app/staff/van-runs/actions"
import { DogFlagBadges } from "@/components/staff/dog-flag-badges"
import type { DogFlagType } from "@/generated/prisma/client"

type Status = "PENDING" | "COLLECTED" | "WALKED" | "DROPPED_OFF"

const NEXT_STATUS: Record<Status, Exclude<Status, "PENDING"> | null> = {
  PENDING: "COLLECTED",
  COLLECTED: "WALKED",
  WALKED: "DROPPED_OFF",
  DROPPED_OFF: null,
}

const NEXT_LABEL: Record<Status, string> = {
  PENDING: "Mark collected",
  COLLECTED: "Mark walked",
  WALKED: "Mark dropped off",
  DROPPED_OFF: "Done",
}

export function VanRunStopItem({
  stopId,
  dogName,
  pickupAddress,
  accessNotes,
  status,
  flags = [],
}: {
  stopId: string
  dogName: string
  pickupAddress: string
  accessNotes: string | null
  status: Status
  flags?: { type: DogFlagType; notes: string | null }[]
}) {
  const [current, setCurrent] = React.useState(status)
  const [pending, setPending] = React.useState(false)
  const next = NEXT_STATUS[current]

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
      <div className="space-y-1">
        <p className="flex items-center gap-2 font-medium">
          {dogName}
          <DogFlagBadges flags={flags} />
        </p>
        <p className="text-muted-foreground">{pickupAddress}</p>
        {accessNotes && <p className="text-muted-foreground">Access: {accessNotes}</p>}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={current === "DROPPED_OFF" ? "default" : "secondary"} className="capitalize">
          {current.toLowerCase().replace("_", " ")}
        </Badge>
        {next && (
          <Button
            size="sm"
            disabled={pending}
            onClick={async () => {
              setPending(true)
              await updateVanRunStopStatus(stopId, next)
              setCurrent(next)
              setPending(false)
            }}
          >
            {pending ? "Updating…" : NEXT_LABEL[current]}
          </Button>
        )}
      </div>
    </li>
  )
}
