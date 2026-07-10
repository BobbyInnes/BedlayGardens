import type { PricingModel } from "@/generated/prisma/client"

const gbpFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
})

export function formatPence(pence: number): string {
  return gbpFormatter.format(pence / 100)
}

const pricingModelSuffix: Record<PricingModel, string> = {
  PER_NIGHT: "/night",
  PER_DAY: "/day",
  PER_SESSION: "/session",
}

export function formatPriceWithSuffix(pence: number, pricingModel: PricingModel): string {
  return `${formatPence(pence)}${pricingModelSuffix[pricingModel]}`
}
