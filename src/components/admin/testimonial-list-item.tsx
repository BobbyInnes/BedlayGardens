"use client"

import * as React from "react"
import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button"
import { ToggleActiveButton } from "@/components/admin/toggle-active-button"
import {
  updateTestimonial,
  deleteTestimonial,
  toggleTestimonialVisible,
  type AdminActionState,
} from "@/app/admin/content/actions"
import type { Testimonial } from "@/generated/prisma/client"

const initialState: AdminActionState = { status: "idle" }

export function TestimonialListItem({ testimonial }: { testimonial: Testimonial }) {
  const [editing, setEditing] = React.useState(false)
  const [state, formAction, pending] = useActionState(
    updateTestimonial.bind(null, testimonial.id),
    initialState
  )
  const wasPending = React.useRef(false)

  React.useEffect(() => {
    if (wasPending.current && !pending && state.status !== "error") {
      setEditing(false)
    }
    wasPending.current = pending
  }, [pending, state])

  if (!editing) {
    return (
      <li className="space-y-1 p-4 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="font-medium">{testimonial.author}</p>
            <Badge variant={testimonial.visible ? "default" : "outline"}>
              {testimonial.visible ? "Visible" : "Hidden"}
            </Badge>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ToggleActiveButton
              active={testimonial.visible}
              onToggle={toggleTestimonialVisible.bind(null, testimonial.id)}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <ConfirmDeleteButton
              onConfirm={deleteTestimonial.bind(null, testimonial.id)}
              title="Delete this testimonial?"
              description="This removes it from the homepage."
            />
          </div>
        </div>
        <p className="text-muted-foreground">{testimonial.text}</p>
      </li>
    )
  }

  return (
    <li className="p-4">
      <form action={formAction} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor={`author-${testimonial.id}`}>Author</Label>
          <Input id={`author-${testimonial.id}`} name="author" defaultValue={testimonial.author} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`text-${testimonial.id}`}>Testimonial</Label>
          <Textarea id={`text-${testimonial.id}`} name="text" defaultValue={testimonial.text} rows={3} required />
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
        {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      </form>
    </li>
  )
}
