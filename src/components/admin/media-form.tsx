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
import { createMedia, type AdminActionState } from "@/app/admin/media/actions"
import type { GalleryCategory } from "@/generated/prisma/client"

const initialState: AdminActionState = { status: "idle" }

export function MediaForm({ categories }: { categories: GalleryCategory[] }) {
  const [state, formAction, pending] = useActionState(createMedia, initialState)
  const [type, setType] = useState("IMAGE")
  const [usage, setUsage] = useState("GALLERY")

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select name="type" value={type} onValueChange={setType}>
            <SelectTrigger id="type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="IMAGE">Image</SelectItem>
              <SelectItem value="VIDEO">Video</SelectItem>
              <SelectItem value="EMBED">YouTube/Vimeo embed</SelectItem>
            </SelectContent>
          </Select>
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
      </div>

      {type === "EMBED" ? (
        <div className="space-y-2">
          <Label htmlFor="embedUrl">Embed URL</Label>
          <Input
            id="embedUrl"
            name="embedUrl"
            placeholder="https://www.youtube.com/embed/VIDEO_ID"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="file">File</Label>
          <Input id="file" name="file" type="file" accept={type === "IMAGE" ? "image/*" : "video/*"} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="caption">Caption</Label>
          <Input id="caption" name="caption" />
        </div>
        {usage === "GALLERY" ? (
          <div className="space-y-2">
            <Label htmlFor="galleryCategoryId">Gallery category</Label>
            <Select name="galleryCategoryId" defaultValue="none">
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
            <p className="text-xs text-muted-foreground">
              Which filter button this shows under on the public gallery page. Manage the list
              of categories above.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input id="category" name="category" placeholder="accommodation, forest walks…" />
            <p className="text-xs text-muted-foreground">
              For &ldquo;Service page&rdquo; photos, set this to the service&rsquo;s slug (e.g.
              daycare, overnight-boarding) so it appears on that service&rsquo;s card.
            </p>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="altText">Alt text</Label>
          <Input id="altText" name="altText" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sortOrder">Sort order</Label>
          <Input id="sortOrder" name="sortOrder" type="number" defaultValue={0} />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Uploading…" : "Add media"}
      </Button>
      {state.status === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
    </form>
  )
}
