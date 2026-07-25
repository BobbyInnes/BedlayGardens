"use client"

import * as React from "react"
import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button"
import {
  updateGalleryCategory,
  deleteGalleryCategory,
  type AdminActionState,
} from "@/app/admin/media/actions"
import type { GalleryCategory } from "@/generated/prisma/client"

const initialState: AdminActionState = { status: "idle" }

export function GalleryCategoryListItem({
  category,
  itemCount,
}: {
  category: GalleryCategory
  itemCount: number
}) {
  const [editing, setEditing] = React.useState(false)
  const [state, formAction, pending] = useActionState(
    updateGalleryCategory.bind(null, category.id),
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
      <li className="flex items-center justify-between gap-3 p-3 text-sm">
        <div>
          <span className="font-medium">{category.name}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {itemCount} photo{itemCount === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            Rename
          </Button>
          <ConfirmDeleteButton
            onConfirm={deleteGalleryCategory.bind(null, category.id)}
            title={`Delete "${category.name}"?`}
            description={
              itemCount > 0
                ? `${itemCount} photo${itemCount === 1 ? "" : "s"} currently in this category will become uncategorized — they stay in the gallery, just without this filter.`
                : "This category isn't used by any photos yet."
            }
          />
        </div>
      </li>
    )
  }

  return (
    <li className="p-3">
      <form action={formAction} className="flex items-end gap-2">
        <div className="space-y-2">
          <Label htmlFor={`category-name-${category.id}`}>Name</Label>
          <Input
            id={`category-name-${category.id}`}
            name="name"
            defaultValue={category.name}
            required
            className="w-56"
          />
        </div>
        <input type="hidden" name="sortOrder" value={category.sortOrder} />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </form>
      {state.status === "error" && <p className="mt-2 text-sm text-destructive">{state.message}</p>}
    </li>
  )
}
