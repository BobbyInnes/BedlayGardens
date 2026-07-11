import { prisma } from "@/lib/prisma"

export type OptOutType = "ABANDONED_BOOKING_REMINDER"

function parsePerType(perType: string | null): Record<string, string> {
  if (!perType) return {}
  try {
    return JSON.parse(perType)
  } catch {
    return {}
  }
}

export async function isOptedOut(customerId: string, type: OptOutType): Promise<boolean> {
  const preference = await prisma.notificationPreference.findUnique({ where: { customerId } })
  const perType = parsePerType(preference?.perType ?? null)
  return perType[type] === "off"
}

export async function setOptOut(customerId: string, type: OptOutType, optedOut: boolean): Promise<void> {
  const preference = await prisma.notificationPreference.findUnique({ where: { customerId } })
  const perType = parsePerType(preference?.perType ?? null)
  if (optedOut) perType[type] = "off"
  else delete perType[type]

  await prisma.notificationPreference.upsert({
    where: { customerId },
    update: { perType: JSON.stringify(perType) },
    create: { customerId, perType: JSON.stringify(perType) },
  })
}
