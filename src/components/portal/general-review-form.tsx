"use client"

import * as React from "react"
import { useActionState } from "react"
import { Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { submitGeneralReview, type ReviewActionState } from "@/app/portal/reviews/actions"

const initialState: ReviewActionState = { status: "idle" }

export function GeneralReviewForm({
  existing,
}: {
  existing: { rating: number; text: string | null; status: "PENDING" | "APPROVED" | "REJECTED" } | null
}) {
  const [state, formAction, pending] = useActionState(submitGeneralReview, initialState)
  const [rating, setRating] = React.useState(existing?.rating ?? 5)

  return (
    <form action={formAction} className="max-w-lg space-y-3 rounded-lg border border-border p-4">
      <input type="hidden" name="rating" value={rating} />
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} type="button" onClick={() => setRating(star)} aria-label={`${star} stars`}>
            <Star
              className={`size-6 ${star <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`}
            />
          </button>
        ))}
      </div>
      <Textarea
        name="text"
        placeholder="Tell us about your overall experience (optional)"
        rows={3}
        defaultValue={existing?.text ?? ""}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : existing ? "Update review" : "Submit review"}
        </Button>
        {existing && (
          <span className="text-xs text-muted-foreground capitalize">{existing.status.toLowerCase()}</span>
        )}
      </div>
      {state.status === "idle" && state.message && (
        <p className="text-sm text-primary">{state.message}</p>
      )}
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
    </form>
  )
}
