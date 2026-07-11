import { prisma } from "@/lib/prisma"

export async function getActiveAgreement() {
  return prisma.agreement.findFirst({ where: { active: true }, orderBy: { publishedAt: "desc" } })
}

export async function hasCurrentSignedAgreement(customerId: string): Promise<boolean> {
  const active = await getActiveAgreement()
  if (!active) return true // no agreement configured yet — don't block bookings

  const signed = await prisma.signedAgreement.findFirst({
    where: { customerId, agreementId: active.id },
  })
  return !!signed
}
