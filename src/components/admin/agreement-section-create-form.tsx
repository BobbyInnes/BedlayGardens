"use client"

import { useActionState, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/admin/rich-text-editor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createAgreementSection, type AdminActionState } from "@/app/admin/content/actions"
import { AGREEMENT_SECTION_NAMES } from "@/lib/agreement-sections"

const initialState: AdminActionState = { status: "idle" }

export function AgreementSectionCreateForm() {
  const formRef = useRef<HTMLFormElement>(null)
  // RichTextEditor and Select are uncontrolled and don't reset on native
  // form.reset() — bump this to remount them cleared after a successful add.
  const [formKey, setFormKey] = useState(0)
  const [state, formAction, pending] = useActionState(async (prev: AdminActionState, formData: FormData) => {
    const result = await createAgreementSection(prev, formData)
    if (result.status === "idle") {
      formRef.current?.reset()
      setFormKey((k) => k + 1)
    }
    return result
  }, initialState)

  return (
    <form
      key={formKey}
      ref={formRef}
      action={formAction}
      className="max-w-xl space-y-3 rounded-lg border border-border p-4"
    >
      <div className="space-y-2">
        <Label htmlFor="new-section-name">Name</Label>
        <Select name="name" required>
          <SelectTrigger id="new-section-name" className="w-full">
            <SelectValue placeholder="Select a section" />
          </SelectTrigger>
          <SelectContent>
            {AGREEMENT_SECTION_NAMES.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-section-text">Text</Label>
        <RichTextEditor name="text" placeholder="Section text…" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-section-sortOrder">Sort order</Label>
        <Input id="new-section-sortOrder" name="sortOrder" type="number" defaultValue={0} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add Text"}
      </Button>
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
    </form>
  )
}
