"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

export function ConfirmDeleteButton({
  onConfirm,
  label = "Delete",
  title = "Delete this?",
  description = "This cannot be undone.",
}: {
  // Returning { error } (instead of resolving void) keeps the dialog open
  // and shows the message — for an expected, recoverable "can't delete
  // this" outcome (e.g. it has history) rather than a genuine bug.
  onConfirm: () => Promise<{ error?: string } | void>
  label?: string
  title?: string
  description?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setError(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={async () => {
                setPending(true)
                setError(null)
                const result = await onConfirm()
                setPending(false)
                if (result?.error) {
                  setError(result.error)
                  return
                }
                setOpen(false)
              }}
            >
              {pending ? "Working…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
