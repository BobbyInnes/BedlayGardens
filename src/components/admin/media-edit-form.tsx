"use client"

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { GalleryCategory, MediaItem } from "@/generated/prisma/client"
import { updateMedia, type AdminActionState } from "@/app/admin/media/actions"

const initialState: AdminActionState = { status: "idle" }

export function MediaEditForm({
  media,
  categories,
}: {
  media: MediaItem
  categories: GalleryCategory[]
}) {
  const [state, formAction, pending] = useActionState(
    updateMedia.bind(null, media.id),
    initialState
  )
  const [usage, setUsage] = useState<string>(media.usage)

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      {media.type !== "EMBED" && (
        <div className="space-y-2">
          <Label htmlFor="file">Replace file (optional)</Label>
          <Input id="file" name="file" type="file" accept={media.type === "IMAGE" ? "image/*" : "video/*"} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="caption">Caption</Label>
          <Input id="caption" name="caption" defaultValue={media.caption ?? ""} />
        </div>
        {usage === "GALLERY" ? (
          <div className="space-y-2">
            <Label htmlFor="galleryCategoryId">Gallery category</Label>
            <Select name="galleryCategoryId" defaultValue={media.galleryCategoryId ?? "none"}>
              <SelectTrigger id="galleryCategoryId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorized</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input id="category" name="category" defaultValue={media.category ?? ""} />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="altText">Alt text</Label>
          <Input id="altText" name="altText" defaultValue={media.altText ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sortOrder">Sort order</Label>
          <Input id="sortOrder" name="sortOrder" type="number" defaultValue={media.sortOrder} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="usage">Used on</Label>
        <Select name="usage" value={usage} onValueChange={setUsage}>
          <SelectTrigger id="usage" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GALLERY">Gallery</SelectItem>
            <SelectItem value="HERO">Homepage hero</SelectItem>
            <SelectItem value="SERVICE">Service page</SelectItem>
            <SelectItem value="ABOUT">About page</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
      {state.status === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
    </form>
  )
}
