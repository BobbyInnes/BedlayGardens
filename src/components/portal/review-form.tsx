"use client"

import * as React from "react"
import { useActionState } from "react"
import { Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { submitReview, type ReviewActionState } from "@/app/portal/reviews/actions"

const initialState: ReviewActionState = { status: "idle" }

export function ReviewForm({ bookingId, serviceName }: { bookingId: string; serviceName: string }) {
  const [state, formAction, pending] = useActionState(submitReview, initialState)
  const [rating, setRating] = React.useState(5)

  if (state.status === "idle" && state.message) {
    return <p className="text-sm text-primary">{state.message}</p>
  }

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border p-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="rating" value={rating} />
      <p className="text-sm font-medium">{serviceName}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} type="button" onClick={() => setRating(star)} aria-label={`${star} stars`}>
            <Star
              className={`size-6 ${star <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`}
            />
          </button>
        ))}
      </div>
      <Textarea name="text" placeholder="Tell us about your stay (optional)" rows={3} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Submitting…" : "Submit review"}
      </Button>
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
    </form>
  )
}
