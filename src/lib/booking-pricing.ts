import type { PricingModel } from "@/generated/prisma/client"
import { getSettings } from "@/lib/settings"

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
 */
export async function computeBookingPrice(options: {
  pricingModel: PricingModel
  basePricePence: number
  units: number // nights for boarding, 1 otherwise
  dogCount: number
  addons: PricedAddon[]
}): Promise<BookingPriceBreakdown> {
  const settings = await getSettings()
  const depositPercent = Number(settings.deposit_percent ?? "25")
  const secondDogDiscountPercent = Number(settings.second_dog_discount_percent ?? "0")

  let basePricePence: number
  if (options.pricingModel === "PER_NIGHT" && options.dogCount >= 2) {
    const firstDogTotal = options.basePricePence * options.units
    const additionalDogRate = options.basePricePence * (1 - secondDogDiscountPercent / 100)
    const additionalDogsTotal = additionalDogRate * options.units * (options.dogCount - 1)
    basePricePence = Math.round(firstDogTotal + additionalDogsTotal)
  } else {
    basePricePence = options.basePricePence * options.units * options.dogCount
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
