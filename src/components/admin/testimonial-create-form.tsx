"use client"

import { useActionState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createTestimonial, type AdminActionState } from "@/app/admin/content/actions"

const initialState: AdminActionState = { status: "idle" }

export function TestimonialCreateForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(async (prev: AdminActionState, formData: FormData) => {
    const result = await createTestimonial(prev, formData)
    if (result.status === "idle") formRef.current?.reset()
    return result
  }, initialState)

  return (
    <form ref={formRef} action={formAction} className="max-w-xl space-y-3 rounded-lg border border-border p-4">
      <div className="space-y-2">
        <Label htmlFor="new-author">Author</Label>
        <Input id="new-author" name="author" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-text">Testimonial</Label>
        <Textarea id="new-text" name="text" rows={3} required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add testimonial"}
      </Button>
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
    </form>
  )
}
