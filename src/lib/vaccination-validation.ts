// Validation shared between the two ways a vaccination record can be added
// (manual entry in app/portal/vaccinations/actions.ts, and the OCR-extracted
// certificate upload in app/portal/vaccinations/upload/actions.ts) so a
// record can't get looser rules just by going through one path vs the other.
import { prisma } from "@/lib/prisma"
import { FIXED_VACCINES } from "@/app/portal/vaccinations/vaccine-types"

// Calendar-date add, not a fixed day count, so it's not thrown off by leap
// years. Used to derive a fixed vaccine's expiry from its from date.
export function addYears(dateStr: string, years: number): string {
  const date = new Date(dateStr)
  date.setFullYear(date.getFullYear() + years)
  return date.toISOString().slice(0, 10)
}

// The from date itself shouldn't be able to predate today by more than this
// many years (e.g. DHPP given "5 years ago"), independent of the validity
// gap above.
export function isMoreThanYearsAgo(dateGiven: string, maxYears: number): boolean {
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - maxYears)
  return new Date(dateGiven).getTime() < cutoff.getTime()
}

// Matches a free-text vaccine type against the fixed list (DHPP,
// Leptospirosis, Kennel Cough) so a record that names one of these — whether
// typed manually or read off a certificate by OCR — gets the same
// from-date-age check and server-derived expiry, not just whatever an OCR
// misread or a typo produced.
export function findFixedVaccine(type: string) {
  const normalized = type.trim().toLowerCase()
  return FIXED_VACCINES.find((vaccine) => vaccine.type.toLowerCase() === normalized)
}

// Don't let a new record be added for a vaccine the dog is already currently
// covered for — only once the existing one is closer to expiry (or has
// expired) should a replacement be added.
export async function activeDuplicateError(
  dogId: string,
  dogName: string,
  type: string
): Promise<string | null> {
  const existing = await prisma.vaccinationRecord.findFirst({
    where: { dogId, type: { equals: type, mode: "insensitive" }, expiryDate: { gte: new Date() } },
    orderBy: { expiryDate: "desc" },
  })
  if (!existing) return null
  return `${dogName} already has a valid ${type} vaccination, expiring ${existing.expiryDate.toLocaleDateString("en-GB")}.`
}
