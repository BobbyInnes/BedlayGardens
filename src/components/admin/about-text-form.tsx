"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { RichTextEditor } from "@/components/admin/rich-text-editor"
import { type AdminActionState } from "@/app/admin/content/actions"

const initialState: AdminActionState = { status: "idle" }

// Shared editor for the About Us page prose sections (Our story, Our facility).
// The specific server action and setting name are passed in per section.
export function AboutTextForm({
  action,
  name,
  value,
  placeholder,
  helpText,
}: {
  action: (state: AdminActionState, formData: FormData) => Promise<AdminActionState>
  name: string
  value: string
  placeholder?: string
  helpText: string
}) {
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="max-w-2xl space-y-3">
      <RichTextEditor name={name} defaultValue={value} placeholder={placeholder} />
      <p className="text-xs text-muted-foreground">{helpText}</p>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state.message && (
          <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  )
}
