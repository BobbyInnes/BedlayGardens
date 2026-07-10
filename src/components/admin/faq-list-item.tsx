"use client"

import * as React from "react"
import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button"
import { updateFaq, deleteFaq, type AdminActionState } from "@/app/admin/content/actions"
import type { Faq } from "@/generated/prisma/client"

const initialState: AdminActionState = { status: "idle" }

export function FaqListItem({ faq }: { faq: Faq }) {
  const [editing, setEditing] = React.useState(false)
  const [state, formAction, pending] = useActionState(updateFaq.bind(null, faq.id), initialState)
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
          <p className="font-medium">{faq.question}</p>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <ConfirmDeleteButton
              onConfirm={deleteFaq.bind(null, faq.id)}
              title="Delete this FAQ?"
              description="This removes it from the public FAQs page."
            />
          </div>
        </div>
        <p className="text-muted-foreground">{faq.answer}</p>
      </li>
    )
  }

  return (
    <li className="p-4">
      <form action={formAction} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor={`question-${faq.id}`}>Question</Label>
          <Input id={`question-${faq.id}`} name="question" defaultValue={faq.question} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`answer-${faq.id}`}>Answer</Label>
          <Textarea id={`answer-${faq.id}`} name="answer" defaultValue={faq.answer} rows={3} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`sortOrder-${faq.id}`}>Sort order</Label>
          <Input
            id={`sortOrder-${faq.id}`}
            name="sortOrder"
            type="number"
            defaultValue={faq.sortOrder}
          />
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
