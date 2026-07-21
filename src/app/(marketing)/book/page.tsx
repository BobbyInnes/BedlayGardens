import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, AlertTriangle } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { formatPriceWithSuffix } from "@/lib/format"
import { sanitizeRichText } from "@/lib/sanitize-html"

export const metadata: Metadata = {
  title: "Book a Stay",
  description: "Book overnight boarding, daycare, secure forest walks, or dog walking at Bedlay Gardens LTD.",
}

export const revalidate = 60

export default async function BookPage() {
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Book a Stay</h1>
        <p className="mt-3 text-muted-foreground">
          Choose a service to check availability and book online.
        </p>
      </div>

      <div className="mb-8 flex items-start gap-3 rounded-xl border border-destructive bg-destructive/10 p-4 text-destructive sm:items-center">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 sm:mt-0" aria-hidden="true" />
        <p className="text-sm font-bold sm:text-base">
          For all new dogs, a mandatory Meet &amp; Greet evaluation is required before booking
          any service.
        </p>
      </div>

      <div className="space-y-4">
        {services.map((service) => (
          <Link
            key={service.id}
            href={`/book/${service.slug}`}
            className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/50"
          >
            <div>
              <p className="font-semibold">{service.name}</p>
              <div
                className="mt-1 text-sm text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(service.description) }}
              />
              <p className="mt-2 text-sm font-medium text-primary">
                {formatPriceWithSuffix(service.basePricePence, service.pricingModel)}
              </p>
            </div>
            <ArrowRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  )
}
