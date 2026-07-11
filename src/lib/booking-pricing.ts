import type { PricingModel } from "@/generated/prisma/client"
import { getSettings } from "@/lib/settings"
import { getApplicablePriceRules, priceForDate } from "@/lib/price-rules"

export type PricedAddon = { pricePence: number; quantity: number }

export type BookingPriceBreakdown = {
  basePricePence: number
  addonsPricePence: number
  totalPence: number
  depositPence: number
  balancePence: number
  depositPercent: number
}

/**
 * Boarding: first dog full price per night, additional dogs get the
 * second-dog discount. Daycare/forest-walks/dog-walking: base price per dog
 * for the single day/session/run — see PRD §14 open question re: exact
 * boarding sharing discount, currently admin-configurable via Settings.
 *
 * `dates` is one entry per night for boarding, or a single-entry array for
 * every other service — each date's rate is looked up individually against
 * any admin-defined seasonal `PriceRule` for the service before summing, so
 * a stay spanning into/out of a peak window is priced night-by-night.
 */
export async function computeBookingPrice(options: {
  serviceId: string
  pricingModel: PricingModel
  basePricePence: number
  dates: Date[]
  dogCount: number
  addons: PricedAddon[]
}): Promise<BookingPriceBreakdown> {
  const settings = await getSettings()
  const depositPercent = Number(settings.deposit_percent ?? "25")
  const secondDogDiscountPercent = Number(settings.second_dog_discount_percent ?? "0")

  const rules = await getApplicablePriceRules(options.serviceId, options.dates)
  const nightlyRates = options.dates.map((date) => priceForDate(options.basePricePence, date, rules))
  const firstDogTotal = nightlyRates.reduce((sum, rate) => sum + rate, 0)

  let basePricePence: number
  if (options.pricingModel === "PER_NIGHT" && options.dogCount >= 2) {
    const additionalDogsTotal =
      nightlyRates.reduce((sum, rate) => sum + rate * (1 - secondDogDiscountPercent / 100), 0) *
      (options.dogCount - 1)
    basePricePence = Math.round(firstDogTotal + additionalDogsTotal)
  } else {
    basePricePence = firstDogTotal * options.dogCount
  }

  const addonsPricePence = options.addons.reduce(
    (sum, addon) => sum + addon.pricePence * addon.quantity,
    0
  )

  const totalPence = basePricePence + addonsPricePence
  const depositPence = Math.round(totalPence * (depositPercent / 100))
  const balancePence = totalPence - depositPence

  return { basePricePence, addonsPricePence, totalPence, depositPence, balancePence, depositPercent }
}
