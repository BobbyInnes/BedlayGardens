"use client"

import * as React from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type GalleryItem = {
  id: string
  type: "IMAGE" | "VIDEO" | "EMBED"
  url: string
  thumbnailUrl: string | null
  caption: string | null
  altText: string | null
  category: string | null
}

export function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const categories = React.useMemo(() => {
    const set = new Set<string>()
    for (const item of items) {
      if (item.category) set.add(item.category)
    }
    return Array.from(set)
  }, [items])

  const [activeCategory, setActiveCategory] = React.useState<string | null>(null)
  const [openIndex, setOpenIndex] = React.useState<number | null>(null)

  const filtered = React.useMemo(
    () => (activeCategory ? items.filter((item) => item.category === activeCategory) : items),
    [items, activeCategory]
  )

  const activeItem = openIndex !== null ? filtered[openIndex] : null

  return (
    <div>
      <div className="mb-8 flex flex-wrap gap-2">
        <Button
          variant={activeCategory === null ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveCategory(null)}
        >
          All
        </Button>
        {categories.map((category) => (
          <Button
            key={category}
            variant={activeCategory === category ? "default" : "outline"}
            size="sm"
            className="capitalize"
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setOpenIndex(index)}
            className="group relative aspect-4/3 overflow-hidden rounded-lg border border-border bg-muted"
          >
            <Image
              src={item.thumbnailUrl ?? item.url}
              alt={item.altText ?? item.caption ?? "Gallery image"}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {item.type === "VIDEO" && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                <Play className="size-8 text-white drop-shadow" aria-hidden="true" />
              </span>
            )}
            {item.caption && (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 text-left text-xs font-medium text-white">
                {item.caption}
              </span>
            )}
          </button>
        ))}
      </div>

      <Dialog open={openIndex !== null} onOpenChange={(open) => !open && setOpenIndex(null)}>
        <DialogContent showCloseButton={false} className="max-w-3xl border-0 bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">{activeItem?.caption ?? "Gallery preview"}</DialogTitle>
          {activeItem && (
            <div className="relative overflow-hidden rounded-xl bg-background">
              <button
                type="button"
                onClick={() => setOpenIndex(null)}
                className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>

              {filtered.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenIndex((prev) =>
                        prev === null ? null : (prev - 1 + filtered.length) % filtered.length
                      )
                    }
                    className="absolute left-3 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow"
                    aria-label="Previous"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenIndex((prev) => (prev === null ? null : (prev + 1) % filtered.length))
                    }
                    className="absolute right-3 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow"
                    aria-label="Next"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </>
              )}

              <div className={cn("relative aspect-4/3 w-full sm:aspect-video")}>
                {activeItem.type === "VIDEO" ? (
                  <video
                    src={activeItem.url}
                    controls
                    autoPlay
                    className="size-full object-contain"
                  />
                ) : activeItem.type === "EMBED" ? (
                  <iframe
                    src={activeItem.url}
                    className="size-full"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                ) : (
                  <Image
                    src={activeItem.url}
                    alt={activeItem.altText ?? activeItem.caption ?? "Gallery image"}
                    fill
                    sizes="100vw"
                    className="object-contain"
                  />
                )}
              </div>
              {activeItem.caption && (
                <p className="px-4 py-3 text-sm text-muted-foreground">{activeItem.caption}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
