"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { verifyVaccinationRecord } from "@/app/admin/vaccinations/actions"

export function VaccinationVerifyButtons({ recordId }: { recordId: string }) {
  const [pending, setPending] = React.useState<"VERIFIED" | "EXPIRED" | null>(null)

  async function handle(status: "VERIFIED" | "EXPIRED") {
    setPending(status)
    await verifyVaccinationRecord(recordId, status)
    setPending(null)
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        disabled={pending !== null}
        onClick={() => handle("VERIFIED")}
      >
        {pending === "VERIFIED" ? "Saving…" : "Mark verified"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending !== null}
        onClick={() => handle("EXPIRED")}
      >
        {pending === "EXPIRED" ? "Saving…" : "Mark expired"}
      </Button>
    </div>
  )
}
