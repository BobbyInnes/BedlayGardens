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

// The single source of "how do we display a customer/staff member's name" —
// User.name was replaced with separate forename/surname columns (2026-08-25
// app-wide rename), so every display site (bookings, invoices, admin lists,
// staff pages, emails, audit logs) builds its shown name through this rather
// than concatenating the two fields itself.
export function fullName(person: { forename: string; surname: string }): string {
  return `${person.forename} ${person.surname}`.trim()
}
