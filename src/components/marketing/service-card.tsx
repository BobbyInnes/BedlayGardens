import Link from "next/link"
import Image from "next/image"
import { Clock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  formatPenceCompact,
  pricingSuffixLabel,
  serviceDuration,
} from "@/lib/service-display"
import { sanitizeRichText } from "@/lib/sanitize-html"
import { cn } from "@/lib/utils"
import type { PricingModel } from "@/generated/prisma/client"

export function ServiceCard({
  name,
  slug,
  description,
  basePricePence,
  pricingModel,
  imageUrl,
  imageAlt,
}: {
  name: string
  slug: string
  description: string
  basePricePence: number
  pricingModel: PricingModel
  imageUrl?: string | null
  imageAlt?: string | null
}) {
  const duration = serviceDuration(slug)

  return (
    <Card
      className={cn(
        "h-full transition-shadow hover:shadow-lg hover:shadow-primary/5 [--card-spacing:--spacing(6)]",
        imageUrl && "pt-0"
      )}
    >
      {imageUrl && (
        <div className="relative aspect-[16/10] w-full">
          <Image
            src={imageUrl}
            alt={imageAlt ?? name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
          <span className="absolute top-3 right-3 rounded-full bg-navy/90 px-3 py-1 text-xs font-semibold text-white">
            {formatPenceCompact(basePricePence)} {pricingSuffixLabel(pricingModel)}
          </span>
        </div>
      )}
      <CardHeader>
        {!imageUrl && (
          <p className="flex items-baseline gap-1.5">
            <span className="font-heading text-3xl font-bold tracking-tight text-primary">
              {formatPenceCompact(basePricePence)}
            </span>
            <span className="text-sm text-muted-foreground">
              {pricingSuffixLabel(pricingModel)}
            </span>
          </p>
        )}
        <CardTitle className="text-lg font-semibold">{name}</CardTitle>
        {duration && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <Clock className="size-3.5" aria-hidden="true" />
            {duration}
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-6">
        <div
          className="line-clamp-4 flex-1 text-sm text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(description) }}
        />
        <Button asChild className="w-full">
          <Link href={`/book/${slug}`}>
            Book Now <span className="sr-only">— {name}</span>
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
