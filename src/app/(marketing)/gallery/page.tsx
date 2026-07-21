import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { GalleryGrid } from "@/components/marketing/gallery-grid"

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "Photos and videos of our accommodation, secure forest walks, van runs, and happy guests at Bedlay Gardens LTD.",
}

export const revalidate = 60

export default async function GalleryPage() {
  const items = await prisma.mediaItem.findMany({
    where: { usage: "GALLERY" },
    orderBy: { sortOrder: "asc" },
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Gallery</h1>
        <p className="mt-3 text-muted-foreground">
          A look at our accommodation, secure forest walks, van runs, and happy guests.
        </p>
      </div>

      {items.length > 0 ? (
        <GalleryGrid items={items} />
      ) : (
        <p className="text-center text-muted-foreground">
          Photos and videos are coming soon.
        </p>
      )}
    </div>
  )
}
