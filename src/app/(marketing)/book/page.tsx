import type { Metadata } from "next"
import { AlertTriangle } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { formatPriceWithSuffix } from "@/lib/format"
import { formatPenceCompact } from "@/lib/service-display"
import { sanitizeRichText } from "@/lib/sanitize-html"
import { checkTrialGate, formatTrialGateMessage } from "@/lib/trial"
import { BookServiceList, type BookServiceTileData } from "@/components/marketing/book-service-list"

export const metadata: Metadata = {
  title: "Book a Stay",
  description: "Book overnight boarding, daycare, secure forest walks, or dog walking at Bedlay Gardens LTD.",
}

// Personalized per logged-in customer (each service's tile can be blocked
// depending on their dogs' Meet & Greet status), so this can no longer be a
// blanket 60s ISR page — `auth()` reading the session cookie already makes
// it dynamic per request.

export default async function BookPage() {
  const [session, services] = await Promise.all([
    auth(),
    prisma.service.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
  ])

  // Only block a service outright when EVERY dog on the account is missing
  // a passed Meet & Greet — mirrors the gate on /book/[slug], which lets a
  // customer with a mix of eligible/ineligible dogs into the wizard so the
  // dog-selection step can sort that out. A customer with zero dogs yet, or
  // who isn't logged in, isn't blocked here either — /book/[slug] already
  // handles those cases (prompts to add a dog, or to log in) on its own.
  const dogs = session?.user
    ? await prisma.dog.findMany({ where: { ownerId: session.user.id }, select: { id: true } })
    : []

  const tiles: BookServiceTileData[] = await Promise.all(
    services.map(async (service) => {
      let blockedMessage: string | null = null
      if (service.requiresTrial && dogs.length > 0) {
        const missing = await checkTrialGate(
          service.id,
          dogs.map((dog) => dog.id)
        )
        if (missing.length === dogs.length) {
          blockedMessage = formatTrialGateMessage(missing)
        }
      }
      return {
        id: service.id,
        slug: service.slug,
        name: service.name,
        descriptionHtml: sanitizeRichText(service.description),
        priceLabel:
          service.halfDayPricePence != null
            ? `${formatPenceCompact(service.basePricePence)}/Full day & ${formatPenceCompact(service.halfDayPricePence)}/Half day`
            : formatPriceWithSuffix(service.basePricePence, service.pricingModel),
        blockedMessage,
      }
    })
  )

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

      <BookServiceList services={tiles} />
    </div>
  )
}
