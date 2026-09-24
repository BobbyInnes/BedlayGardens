"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TagActionState } from "@/app/admin/tags/actions"

type Tag = { id: string; name: string }

// Admin-only tag chips plus a dropdown of the not-yet-applied, active tags.
// Add/remove are server actions bound to the customer/dog by the page.
export function TagPicker({
  assigned,
  available,
  onAdd,
  onRemove,
  subject,
}: {
  assigned: Tag[]
  available: Tag[]
  onAdd: (tagId: string) => Promise<TagActionState>
  onRemove: (tagId: string) => Promise<TagActionState>
  subject: string
}) {
  const [selected, setSelected] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function run(action: () => Promise<TagActionState>) {
    setPending(true)
    setError(null)
    try {
      const result = await action()
      if (result.status === "error") setError(result.message ?? "Something went wrong.")
      return result.status === "idle"
    } catch {
      setError("Something went wrong. Please try again.")
      return false
    } finally {
      setPending(false)
    }
  }

  async function handleAdd() {
    if (!selected) return
    if (await run(() => onAdd(selected))) setSelected("")
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {assigned.length === 0 && <span className="text-sm text-muted-foreground">No tags.</span>}
        {assigned.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-2 rounded-full bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground"
          >
            {tag.name}
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => onRemove(tag.id))}
              className="hover:underline"
              aria-label={`Remove tag ${tag.name} from ${subject}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {available.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-52" aria-label={`Choose a tag for ${subject}`}>
              <SelectValue placeholder="Select a tag…" />
            </SelectTrigger>
            <SelectContent>
              {available.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" disabled={pending || !selected} onClick={handleAdd}>
            {pending ? "Saving…" : "Add tag"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No more tags to add — manage the list under Admin → Tags.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
