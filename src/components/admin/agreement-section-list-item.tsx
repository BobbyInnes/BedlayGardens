"use client"

import * as React from "react"
import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { RichTextEditor } from "@/components/admin/rich-text-editor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button"
import { ToggleActiveButton } from "@/components/admin/toggle-active-button"
import {
  updateAgreementSection,
  deleteAgreementSection,
  toggleAgreementSectionActive,
  type AdminActionState,
} from "@/app/admin/content/actions"
import { AGREEMENT_SECTION_NAMES } from "@/lib/agreement-sections"
import { sanitizeRichText } from "@/lib/sanitize-html"
import type { AgreementSection } from "@/generated/prisma/client"

const initialState: AdminActionState = { status: "idle" }

export function AgreementSectionListItem({ section }: { section: AgreementSection }) {
  const [editing, setEditing] = React.useState(false)
  const [state, formAction, pending] = useActionState(
    updateAgreementSection.bind(null, section.id),
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
          <p className="font-medium">
            {section.name} {!section.active && <Badge variant="secondary">Inactive</Badge>}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <ToggleActiveButton
              active={section.active}
              onToggle={(next) => toggleAgreementSectionActive(section.id, next)}
            />
            <ConfirmDeleteButton
              onConfirm={deleteAgreementSection.bind(null, section.id)}
              title="Delete this section?"
              description="It'll be removed from any future agreement version you publish."
            />
          </div>
        </div>
        <div
          className="text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(section.text) }}
        />
      </li>
    )
  }

  return (
    <li className="p-4">
      <form action={formAction} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor={`name-${section.id}`}>Name</Label>
          <Select name="name" defaultValue={section.name} required>
            <SelectTrigger id={`name-${section.id}`} className="w-full">
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
          <Label htmlFor={`text-${section.id}`}>Text</Label>
          <RichTextEditor name="text" defaultValue={sanitizeRichText(section.text)} placeholder="Section text…" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`sortOrder-${section.id}`}>Sort order</Label>
          <Input
            id={`sortOrder-${section.id}`}
            name="sortOrder"
            type="number"
            defaultValue={section.sortOrder}
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
