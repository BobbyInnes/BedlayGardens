"use client"

import * as React from "react"
import { TriangleAlert } from "lucide-react"
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
import { formatPence } from "@/lib/format"
import { cancelBooking } from "@/app/portal/bookings/actions"
import type { CancellationPolicyTier } from "@/lib/cancellation-policy"

export function CancelBookingButton({
  bookingId,
  paidPence,
  expectedRefundPence,
  cancellationTier,
  freeDays,
}: {
  bookingId: string
  /** Total successfully paid so far (deposit + balance), before this cancellation. */
  paidPence: number
  /** What our cancellation policy would refund of that, based on how close the stay is. */
  expectedRefundPence: number
  /** Which cancellation-policy tier applies right now, based on how close the stay is. */
  cancellationTier: CancellationPolicyTier
  /** Days before the stay that still count as free cancellation — only used to word the outside-window notice. */
  freeDays: number
}) {
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const [message, setMessage] = React.useState<string | null>(null)

  const forfeitPence = Math.max(0, paidPence - expectedRefundPence)

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Cancel
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this booking?</DialogTitle>
            <DialogDescription>
              This applies our cancellation policy based on how close the stay is.
            </DialogDescription>
          </DialogHeader>
          {message ? (
            <p className="text-sm">{message}</p>
          ) : (
            <>
              {paidPence > 0 && forfeitPence > 0 && (
                <div className="flex gap-3 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-900">
                      {expectedRefundPence > 0
                        ? `Only ${formatPence(expectedRefundPence)} of your ${formatPence(paidPence)} will be refunded`
                        : `${formatPence(paidPence)} won’t be refunded`}
                    </p>
                    <p className="text-amber-800">
                      Per our cancellation policy, {formatPence(forfeitPence)} is non-refundable this close to
                      your stay.
                    </p>
                  </div>
                </div>
              )}
              {paidPence > 0 && forfeitPence === 0 && cancellationTier === "free" && (
                <p className="text-sm text-muted-foreground">
                  You&rsquo;re within the free cancellation window — the full {formatPence(paidPence)}{" "}
                  you&rsquo;ve paid will be refunded.
                </p>
              )}
              {paidPence === 0 && cancellationTier !== "free" && (
                <div className="flex gap-3 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-900">
                      This is outside our free cancellation window
                    </p>
                    <p className="text-amber-800">
                      Our free cancellation window is {freeDays} days before the stay — nothing&rsquo;s been paid
                      on this booking yet, so nothing will be forfeited, but do you still want to cancel?
                    </p>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="cancellationReason">Reason (optional)</Label>
                <Textarea
                  id="cancellationReason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Let us know why, if you'd like"
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
                    const result = await cancelBooking(bookingId, reason)
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
