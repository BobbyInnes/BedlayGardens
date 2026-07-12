import type { PricingModel } from "@/generated/prisma/client"

// Display-only card metadata keyed by service slug (same hardcoded-by-slug
// convention as ON_SITE_SERVICE_SLUGS). Durations come from
// DESIGN-bedlay-gardens.md §4 — half-day daycare and 3-hour forest walks are
// described in the service copy, since the booking engine prices one base
// rate per service.
const SERVICE_DURATIONS: Record<string, string> = {
  "meet-greet": "1 hour",
  daycare: "To 12:30pm or 5pm",
  "secure-forest-walks": "1 or 3 hours",
  "dog-walking": "Per session",
  "overnight-boarding": "Overnight",
}

export function serviceDuration(slug: string): string | undefined {
  return SERVICE_DURATIONS[slug]
}

const pricingModelLabel: Record<PricingModel, string> = {
  PER_NIGHT: "per night",
  PER_DAY: "per day",
  PER_SESSION: "per session",
}

export function pricingSuffixLabel(pricingModel: PricingModel): string {
  return pricingModelLabel[pricingModel]
}

// "£15" rather than "£15.00" for the marketing price cards.
export function formatPenceCompact(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
  }).format(pence / 100)
}
