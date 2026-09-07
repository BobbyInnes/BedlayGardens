import { prisma } from "@/lib/prisma"
import type { NotificationChannel } from "@/generated/prisma/client"

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

// "Pet Care Updates" groups every non-mandatory, non-marketing notification
// type routed through notifyCustomer() (pickup/drop-off, check-in and
// balance-due reminders, waitlist offers, vaccination review/risk alerts,
// upcoming-booking reminders) behind one settings toggle per channel — the
// notification-settings UI (registration + portal account) shows one row
// for the whole group rather than one row per NotificationType.
//
// Reuses the same `perType` JSON blob as the opt-out helpers above rather
// than a new column, keyed "PET_CARE_UPDATES" (email) / "sms:PET_CARE_UPDATES"
// (SMS) so no migration is needed. Email defaults to *on* (opt-out, "off"
// turns it off) to match the historical default of every customer getting
// these by email; SMS defaults to *off* (opt-in, "on" turns it on) to match
// the old NotificationPreference.channel default of "EMAIL" — so an
// existing customer who never touches the new toggles keeps receiving
// exactly what they always did. Once a key is explicitly set it takes
// priority over that legacy `channel` fallback.
const PET_CARE_EMAIL_KEY = "PET_CARE_UPDATES"
const PET_CARE_SMS_KEY = "sms:PET_CARE_UPDATES"

export async function getPetCareUpdatesPreference(
  customerId: string
): Promise<{ email: boolean; sms: boolean }> {
  const preference = await prisma.notificationPreference.findUnique({ where: { customerId } })
  return derivePetCareUpdatesPreference(preference?.perType ?? null, preference?.channel ?? null)
}

// Split out so notifyCustomer() (which already loads the NotificationPreference
// row for other reasons) can reuse the pure derivation without a second query.
export function derivePetCareUpdatesPreference(
  perTypeRaw: string | null,
  legacyChannel: NotificationChannel | null
): { email: boolean; sms: boolean } {
  const perType = parsePerType(perTypeRaw)
  const channel = legacyChannel ?? "EMAIL"

  const email =
    perType[PET_CARE_EMAIL_KEY] === "off"
      ? false
      : perType[PET_CARE_EMAIL_KEY] === "on"
        ? true
        : channel === "EMAIL" || channel === "BOTH"

  const sms =
    perType[PET_CARE_SMS_KEY] === "on"
      ? true
      : perType[PET_CARE_SMS_KEY] === "off"
        ? false
        : channel === "SMS" || channel === "BOTH"

  return { email, sms }
}

export async function setPetCareUpdatesPreference(
  customerId: string,
  channel: "email" | "sms",
  enabled: boolean
): Promise<void> {
  const preference = await prisma.notificationPreference.findUnique({ where: { customerId } })
  const perType = parsePerType(preference?.perType ?? null)
  const key = channel === "email" ? PET_CARE_EMAIL_KEY : PET_CARE_SMS_KEY
  perType[key] = enabled ? "on" : "off"

  await prisma.notificationPreference.upsert({
    where: { customerId },
    update: { perType: JSON.stringify(perType) },
    create: { customerId, perType: JSON.stringify(perType) },
  })
}
