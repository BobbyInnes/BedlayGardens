import type { Metadata } from "next"
import Link from "next/link"
import { Clock, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { prisma } from "@/lib/prisma"
import { formatPence } from "@/lib/format"
import { sanitizeRichText } from "@/lib/sanitize-html"
import {
  formatPenceCompact,
  pricingSuffixLabel,
  serviceDuration,
} from "@/lib/service-display"

export const metadata: Metadata = {
  title: "Services & Pricing",
  description:
    "Home boarding, day care, secure forest walks, dog walking, and meet & greet pricing at Bedlay Gardens.",
}

export const revalidate = 60

export default async function ServicesPage() {
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: { addons: { where: { active: true } } },
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mb-10 flex items-start gap-3 rounded-xl border border-destructive bg-destructive/10 p-4 text-destructive sm:items-center">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 sm:mt-0" aria-hidden="true" />
        <p className="text-sm font-bold sm:text-base">
          For all new dogs, a mandatory Meet &amp; Greet evaluation is required before booking
          any service.
        </p>
      </div>

      <div className="mb-12 text-center">
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          Services & Pricing
        </h1>
        <p className="mt-3 text-primary">
          Everything your dog needs, managed in one place.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          All prices in GBP. Live availability and exact totals are shown during booking.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          const duration = serviceDuration(service.slug)
          return (
            <Card
              key={service.id}
              id={service.slug}
              className="h-full scroll-mt-24 transition-shadow hover:shadow-lg hover:shadow-primary/5 [--card-spacing:--spacing(6)]"
            >
              <CardHeader>
                <p className="flex items-baseline gap-1.5">
                  <span className="font-heading text-3xl font-bold tracking-tight text-primary">
                    {formatPenceCompact(service.basePricePence)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {pricingSuffixLabel(service.pricingModel)}
                  </span>
                </p>
                <CardTitle className="text-lg font-semibold">{service.name}</CardTitle>
                {duration && (
                  <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {duration}
                  </p>
                )}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-6">
                <div className="flex-1 space-y-4">
                  <div
                    className="text-sm text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: sanitizeRichText(service.description) }}
                  />

                  {service.addons.length > 0 && (
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">Add-ons</h2>
                      <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                        {service.addons.map((addon) => (
                          <li
                            key={addon.id}
                            className="flex items-center justify-between gap-4 px-3 py-2 text-sm"
                          >
                            <span className="text-muted-foreground">{addon.name}</span>
                            <span className="shrink-0 font-medium text-foreground">
                              {formatPence(addon.pricePence)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <Button asChild className="w-full">
                  <Link href={`/book/${service.slug}`}>
                    Book Now <span className="sr-only">— {service.name}</span>
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
