"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { uploadBookingBelongingPhotos } from "@/app/admin/bookings/actions"

type BookingDog = { dogId: string; dogName: string }
type Photo = { id: string; url: string; dogName: string; createdAt: string }

export function BookingBelongingPhotosSection({
  bookingId,
  dogs,
  photos,
}: {
  bookingId: string
  dogs: BookingDog[]
  photos: Photo[]
}) {
  const [selectedDogId, setSelectedDogId] = React.useState(dogs[0]?.dogId ?? "")
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<{ text: string; error: boolean } | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // The "Upload photos" button opens the file picker; the photos are uploaded
  // as soon as they've been chosen.
  async function handleFilesChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget
    const files = Array.from(input.files ?? [])
    if (files.length === 0) return

    setPending(true)
    setMessage(null)
    const formData = new FormData()
    formData.set("dogId", selectedDogId)
    files.forEach((file) => formData.append("files", file))

    try {
      const result = await uploadBookingBelongingPhotos(bookingId, formData)
      setMessage({ text: result.message ?? "", error: result.status === "error" })
    } catch {
      setMessage({ text: "Upload failed. Please try again.", error: true })
    } finally {
      // Reset so choosing the same photo again still fires onChange.
      input.value = ""
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      {photos.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="space-y-1">
              <div className="aspect-square overflow-hidden rounded-md bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/files/${photo.url}`}
                  alt={`Belongings for ${photo.dogName}`}
                  className="size-full object-cover"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {photo.dogName} — {photo.createdAt}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No belongings photos yet.</p>
      )}

      <div className="max-w-lg space-y-3">
        {dogs.length > 1 && (
          <div className="space-y-2">
            <Label>Dog</Label>
            <Select value={selectedDogId} onValueChange={setSelectedDogId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dogs.map((dog) => (
                  <SelectItem key={dog.dogId} value={dog.dogId}>
                    {dog.dogName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFilesChosen}
        />

        <div className="flex items-center gap-3">
          <Button type="button" disabled={pending} onClick={() => fileInputRef.current?.click()}>
            {pending ? "Uploading…" : "Upload photos"}
          </Button>
          {message && (
            <p className={message.error ? "text-sm text-destructive" : "text-sm text-primary"}>
              {message.text}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
