import { prisma } from "@/lib/prisma"

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

// Agreement.version has always been a plain numeric string ("1", "2", …) —
// bump the highest one seen so far, or start at "1" if this is the first
// version ever published (or an old version somehow isn't numeric).
export function nextAgreementVersion(currentVersion: string | undefined): string {
  const current = currentVersion ? Number.parseInt(currentVersion, 10) : 0
  return String((Number.isFinite(current) ? current : 0) + 1)
}
