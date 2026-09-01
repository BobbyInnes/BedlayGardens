import { prisma } from "@/lib/prisma"
import { fullName } from "@/lib/format"

// documentUrl: { not: null } excludes an active row left over from before
// the switch to PDF uploads (or any active row an admin somehow left without
// a document) — otherwise hasCurrentSignedAgreement below would block
// bookings on a version with no document for the customer to actually view
// or sign, while /portal/agreement (which also requires documentUrl) shows
// "nothing published" — a dead end for the customer either way.
export async function getActiveAgreement() {
  return prisma.agreement.findFirst({
    where: { active: true, documentUrl: { not: null } },
    orderBy: { publishedAt: "desc" },
  })
}

export async function hasCurrentSignedAgreement(customerId: string): Promise<boolean> {
  const active = await getActiveAgreement()
  if (!active) return true // no agreement configured yet — don't block bookings

  const signed = await prisma.signedAgreement.findFirst({
    where: { customerId, agreementId: active.id },
  })
  return !!signed
}

// Case/whitespace-insensitive, and tolerant of a typed period after an
// abbreviated salutation ("Mr." vs "Mr") — not a security boundary, just
// normalizing incidental formatting differences before comparing.
function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ")
}

// The customer types their own name to sign the agreement — accept it with
// or without their salutation (both "Jane Smith" and "Mrs Jane Smith" pass
// for a customer with salutation "Mrs"), but reject a name that doesn't
// match their account at all, so a typo'd or random signature can't be
// recorded as a legally-binding agreement.
export function matchesCustomerName(
  signedName: string,
  customer: { salutation?: string | null; forename: string; surname: string }
): boolean {
  const typed = normalizeName(signedName)
  if (typed === normalizeName(fullName(customer))) return true
  if (!customer.salutation) return false
  return typed === normalizeName(`${customer.salutation} ${fullName(customer)}`)
}

// Agreement.version has always been a plain numeric string ("1", "2", …) —
// bump the highest one seen so far, or start at "1" if this is the first
// version ever published (or an old version somehow isn't numeric).
export function nextAgreementVersion(currentVersion: string | undefined): string {
  const current = currentVersion ? Number.parseInt(currentVersion, 10) : 0
  return String((Number.isFinite(current) ? current : 0) + 1)
}
