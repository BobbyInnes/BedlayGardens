"use client"

import { useActionState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createGalleryCategory, type AdminActionState } from "@/app/admin/media/actions"

const initialState: AdminActionState = { status: "idle" }

export function GalleryCategoryCreateForm({ nextSortOrder }: { nextSortOrder: number }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(async (prev: AdminActionState, formData: FormData) => {
    const result = await createGalleryCategory(prev, formData)
    if (result.status === "idle") formRef.current?.reset()
    return result
  }, initialState)

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="space-y-2">
          <Label htmlFor="new-category-name">New category</Label>
          <Input id="new-category-name" name="name" required className="w-56" />
        </div>
        <input type="hidden" name="sortOrder" value={nextSortOrder} />
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add category"}
        </Button>
      </div>
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
    </form>
  )
}
