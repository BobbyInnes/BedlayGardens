import Link from "next/link"
import { Clock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  formatPenceCompact,
  pricingSuffixLabel,
  serviceDuration,
} from "@/lib/service-display"
import { sanitizeRichText } from "@/lib/sanitize-html"
import type { PricingModel } from "@/generated/prisma/client"

export function ServiceCard({
  name,
  slug,
  description,
  basePricePence,
  pricingModel,
}: {
  name: string
  slug: string
  description: string
  basePricePence: number
  pricingModel: PricingModel
}) {
  const duration = serviceDuration(slug)

  return (
    <Card className="h-full transition-shadow hover:shadow-lg hover:shadow-primary/5 [--card-spacing:--spacing(6)]">
      <CardHeader>
        <p className="flex items-baseline gap-1.5">
          <span className="font-heading text-3xl font-bold tracking-tight text-primary">
            {formatPenceCompact(basePricePence)}
          </span>
          <span className="text-sm text-muted-foreground">
            {pricingSuffixLabel(pricingModel)}
          </span>
        </p>
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
