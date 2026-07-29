"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button"
import { verifyVaccinationRecord, deleteVaccinationRecord } from "@/app/admin/vaccinations/actions"

export function VaccinationVerifyButtons({
  recordId,
  canDelete = false,
}: {
  recordId: string
  canDelete?: boolean
}) {
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
      {canDelete && (
        <ConfirmDeleteButton
          label="Delete"
          title="Delete this vaccination record?"
          description="This permanently deletes the record and its certificate. This cannot be undone."
          onConfirm={deleteVaccinationRecord.bind(null, recordId)}
        />
      )}
    </div>
  )
}
