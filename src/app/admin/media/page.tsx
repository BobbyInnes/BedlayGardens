import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MediaForm } from "@/components/admin/media-form"
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button"
import { GalleryCategoryCreateForm } from "@/components/admin/gallery-category-create-form"
import { GalleryCategoryListItem } from "@/components/admin/gallery-category-list-item"
import { deleteMedia } from "@/app/admin/media/actions"

export const metadata: Metadata = {
  title: "Media | Admin",
}

// Uploading several files in one submit (see createMedia) means the Server
// Action does several sequential storage writes + DB inserts before it can
// respond — comfortably past Vercel's 10s default function timeout with
// more than one or two files. Hobby plan's ceiling is 60s; this route asks
// for the max available rather than the default.
export const maxDuration = 60

export default async function AdminMediaPage() {
  const [items, galleryCategories] = await Promise.all([
    prisma.mediaItem.findMany({
      where: { usage: { not: "PUPDATE" } },
      orderBy: [{ usage: "asc" }, { sortOrder: "asc" }],
      include: { galleryCategory: true },
    }),
    prisma.galleryCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { mediaItems: true } } },
    }),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Media</h1>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Gallery categories</h2>
        <p className="text-sm text-muted-foreground">
          Filter buttons shown on the public gallery page. Renaming updates everywhere the
          category is used; deleting one just leaves its photos uncategorized.
        </p>
        {galleryCategories.length > 0 && (
          <ul className="max-w-xl divide-y divide-border rounded-lg border border-border">
            {galleryCategories.map((category) => (
              <GalleryCategoryListItem
                key={category.id}
                category={category}
                itemCount={category._count.mediaItems}
              />
            ))}
          </ul>
        )}
        <GalleryCategoryCreateForm nextSortOrder={galleryCategories.length} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Add media</h2>
        <MediaForm categories={galleryCategories} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">All media ({items.length})</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex aspect-4/3 items-center justify-center overflow-hidden rounded-md bg-muted">
                {item.type === "IMAGE" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt={item.altText ?? item.caption ?? ""}
                    className="size-full object-cover"
                  />
                ) : item.type === "VIDEO" ? (
                  <video src={item.url} className="size-full object-cover" muted />
                ) : (
                  <span className="text-xs text-muted-foreground">Embed</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{item.caption || "(no caption)"}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.usage === "GALLERY" ? item.galleryCategory?.name : item.category}
                  </p>
                </div>
                <Badge variant="secondary">{item.usage}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/media/${item.id}`}>Edit</Link>
                </Button>
                <ConfirmDeleteButton
                  onConfirm={deleteMedia.bind(null, item.id)}
                  title="Delete this media item?"
                  description={
                    item.usage === "HERO"
                      ? "This is currently used as the homepage hero image — deleting it will remove it from the homepage."
                      : "This removes it everywhere it appears on the public site."
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
