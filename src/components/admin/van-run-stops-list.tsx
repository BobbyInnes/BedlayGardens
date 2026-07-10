"use client"

import * as React from "react"
import { ArrowUp, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { moveStop } from "@/app/admin/van-runs/actions"

type Stop = {
  id: string
  dogName: string
  pickupAddress: string
  status: string
}

export function VanRunStopsList({ vanRunId, stops }: { vanRunId: string; stops: Stop[] }) {
  const [pendingId, setPendingId] = React.useState<string | null>(null)

  async function handleMove(stopId: string, direction: "up" | "down") {
    setPendingId(stopId)
    await moveStop(vanRunId, stopId, direction)
    setPendingId(null)
  }

  if (stops.length === 0) {
    return <p className="text-sm text-muted-foreground">No dogs booked on this run yet.</p>
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {stops.map((stop, index) => (
        <li key={stop.id} className="flex items-center justify-between gap-4 p-3 text-sm">
          <div>
            <p className="font-medium">{stop.dogName}</p>
            <p className="text-muted-foreground">{stop.pickupAddress}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{stop.status}</span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={index === 0 || pendingId === stop.id}
              onClick={() => handleMove(stop.id, "up")}
              aria-label="Move up"
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={index === stops.length - 1 || pendingId === stop.id}
              onClick={() => handleMove(stop.id, "down")}
              aria-label="Move down"
            >
              <ArrowDown className="size-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
