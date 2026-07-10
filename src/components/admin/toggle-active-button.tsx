"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"

export function ToggleActiveButton({
  active,
  onToggle,
}: {
  active: boolean
  onToggle: (nextActive: boolean) => Promise<void>
}) {
  const [pending, setPending] = React.useState(false)

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        await onToggle(!active)
        setPending(false)
      }}
    >
      {pending ? "…" : active ? "Deactivate" : "Activate"}
    </Button>
  )
}
