"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { cancelBookingAdmin } from "@/app/admin/bookings/actions"

export function CancelBookingAdminButton({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const [message, setMessage] = React.useState<string | null>(null)

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Cancel booking
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this booking?</DialogTitle>
            <DialogDescription>
              Any successful payments will be fully refunded via Stripe. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {message ? (
            <p className="text-sm">{message}</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="cancellationReason">Reason (optional)</Label>
                <Textarea
                  id="cancellationReason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="e.g. Customer called to cancel"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                  Keep booking
                </Button>
                <Button
                  variant="destructive"
                  disabled={pending}
                  onClick={async () => {
                    setPending(true)
                    const result = await cancelBookingAdmin(bookingId, reason)
                    setMessage(result.message)
                    setPending(false)
                  }}
                >
                  {pending ? "Cancelling…" : "Yes, cancel"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
