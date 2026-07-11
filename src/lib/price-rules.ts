import { prisma } from "@/lib/prisma"
import type { PriceRule } from "@/generated/prisma/client"

export async function getApplicablePriceRules(serviceId: string, dates: Date[]): Promise<PriceRule[]> {
  if (dates.length === 0) return []
  const min = dates[0]
  const max = dates[dates.length - 1]
  return prisma.priceRule.findMany({
    where: { serviceId, startDate: { lte: max }, endDate: { gte: min } },
  })
}

function ruleForDate(date: Date, rules: PriceRule[]): PriceRule | undefined {
  return rules.find((r) => date >= r.startDate && date <= r.endDate)
}

/** Applies the first matching rule's override/multiplier to the base per-unit price for one night/session. */
export function priceForDate(basePricePence: number, date: Date, rules: PriceRule[]): number {
  const rule = ruleForDate(date, rules)
  if (!rule) return basePricePence
  if (rule.overridePricePence != null) return rule.overridePricePence
  if (rule.multiplier != null) return Math.round(basePricePence * rule.multiplier)
  return basePricePence
}

/** Returns the strictest (highest) minimum-nights requirement among rules overlapping any of the given dates. */
export function minNightsRequired(dates: Date[], rules: PriceRule[]): { minNights: number; label: string } | null {
  let strictest: { minNights: number; label: string } | null = null
  for (const date of dates) {
    const rule = ruleForDate(date, rules)
    if (rule?.minNights && (!strictest || rule.minNights > strictest.minNights)) {
      strictest = { minNights: rule.minNights, label: rule.label }
    }
  }
  return strictest
}
