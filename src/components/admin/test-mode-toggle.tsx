"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { setTestMode } from "@/app/admin/test-mode/actions"

export function TestModeToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant={enabled ? "destructive" : "default"}
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setError(null)
          try {
            await setTestMode(!enabled)
            router.refresh()
          } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong.")
          } finally {
            setPending(false)
          }
        }}
      >
        {pending ? "…" : enabled ? "Turn off" : "Turn on"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
