import type { VaccinationRecord } from "@/generated/prisma/client"

// Shared by the customer portal ("My Dogs") and the admin dog detail page —
// both render the same physical/medical/vaccination/evaluation shape for a
// dog, just from different auth contexts.

const EXPIRING_SOON_DAYS = 30

export function ageYearsMonths(dob: Date | null): { years: number; months: number } | null {
  if (!dob) return null
  const now = new Date()
  let years = now.getFullYear() - dob.getFullYear()
  let months = now.getMonth() - dob.getMonth()
  if (now.getDate() < dob.getDate()) months--
  if (months < 0) {
    years--
    months += 12
  }
  if (years < 0) return null
  return { years, months }
}

export function formatAge(age: { years: number; months: number } | null): string {
  if (!age) return ""
  const parts: string[] = []
  if (age.years > 0) parts.push(`${age.years} Year${age.years === 1 ? "" : "s"}`)
  if (age.months > 0 || age.years === 0) parts.push(`${age.months} Month${age.months === 1 ? "" : "s"}`)
  return `${parts.join(" ")} Old `
}

export type VaccineStatusKind = "expired" | "unverified" | "expiring_soon" | "valid"

// A vaccine's expiry date is only meaningful once staff have actually
// verified the uploaded certificate — until then it reads as "Awaiting
// verification" regardless of dates, never as Valid/Expiring Soon.
export function vaccineStatus(
  record: VaccinationRecord
): { label: string; tone: "ok" | "warn" | "bad"; kind: VaccineStatusKind } {
  const now = new Date()
  const soon = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000)
  const monthYear = record.expiryDate.toLocaleDateString("en-GB", { month: "short", year: "numeric" })
  if (record.expiryDate < now || record.status === "EXPIRED") {
    return { label: `Expired (${monthYear})`, tone: "bad", kind: "expired" }
  }
  if (record.status === "UNVERIFIED") {
    return { label: "Awaiting verification", tone: "warn", kind: "unverified" }
  }
  if (record.expiryDate < soon) {
    return { label: `Expiring Soon (${monthYear})`, tone: "warn", kind: "expiring_soon" }
  }
  return { label: `Valid (${monthYear})`, tone: "ok", kind: "valid" }
}

export const TONE_TEXT_CLASSES: Record<"ok" | "warn" | "bad" | "none", string> = {
  ok: "text-emerald-600",
  warn: "text-amber-600",
  bad: "text-destructive",
  none: "font-bold text-red-600",
}
