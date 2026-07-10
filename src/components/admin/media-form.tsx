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

const initialState: AdminActionState = { status: "idle" }

export function MediaForm() {
  const [state, formAction, pending] = useActionState(createMedia, initialState)
  const [type, setType] = useState("IMAGE")

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
          <Select name="usage" defaultValue="GALLERY">
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
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input id="category" name="category" placeholder="kennels, forest walks…" />
        </div>
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
