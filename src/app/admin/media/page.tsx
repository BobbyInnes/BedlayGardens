import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MediaForm } from "@/components/admin/media-form"
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button"
import { deleteMedia } from "@/app/admin/media/actions"

export const metadata: Metadata = {
  title: "Media | Admin",
}

export default async function AdminMediaPage() {
  const items = await prisma.mediaItem.findMany({
    where: { usage: { not: "PUPDATE" } },
    orderBy: [{ usage: "asc" }, { sortOrder: "asc" }],
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Media</h1>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Add media</h2>
        <MediaForm />
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
                  <p className="text-xs text-muted-foreground">{item.category}</p>
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
