"use client"

import { useActionState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createFaq, type AdminActionState } from "@/app/admin/content/actions"

const initialState: AdminActionState = { status: "idle" }

export function FaqCreateForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(async (prev: AdminActionState, formData: FormData) => {
    const result = await createFaq(prev, formData)
    if (result.status === "idle") formRef.current?.reset()
    return result
  }, initialState)

  return (
    <form ref={formRef} action={formAction} className="max-w-xl space-y-3 rounded-lg border border-border p-4">
      <div className="space-y-2">
        <Label htmlFor="new-question">Question</Label>
        <Input id="new-question" name="question" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-answer">Answer</Label>
        <Textarea id="new-answer" name="answer" rows={3} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-sortOrder">Sort order</Label>
        <Input id="new-sortOrder" name="sortOrder" type="number" defaultValue={0} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add FAQ"}
      </Button>
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
    </form>
  )
}
