"use client"

import * as React from "react"
import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { publishAgreement, type PublishAgreementState } from "@/app/admin/agreement/actions"

const initialState: PublishAgreementState = { status: "idle" }

export function PublishAgreementForm({ nextVersion }: { nextVersion: string }) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [open, setOpen] = React.useState(false)
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [state, formAction, pending] = useActionState(publishAgreement, initialState)
  const wasPending = React.useRef(false)

  React.useEffect(() => {
    if (wasPending.current && !pending && state.status === "success") {
      setOpen(false)
      setFileName(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
    wasPending.current = pending
  }, [pending, state])

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="agreement-pdf">Upload a new version (PDF)</Label>
        <Input
          ref={fileInputRef}
          id="agreement-pdf"
          type="file"
          accept="application/pdf"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </div>
      <Button type="button" onClick={() => setOpen(true)} disabled={!fileName}>
        Publish version {nextVersion}
      </Button>
      {state.status === "success" && <p className="text-sm text-primary">{state.message}</p>}
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish version {nextVersion}?</DialogTitle>
            <DialogDescription>
              Every customer — including anyone who signed an earlier version — will be asked to sign{" "}
              <strong>{fileName}</strong> as version {nextVersion} before their next booking. Once published this
              document can&rsquo;t be swapped out or edited — only superseded by publishing another version. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <form
              action={(formData) => {
                const file = fileInputRef.current?.files?.[0]
                if (file) formData.set("file", file)
                formAction(formData)
              }}
            >
              <Button type="submit" disabled={pending}>
                {pending ? "Publishing…" : "Yes, publish"}
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
