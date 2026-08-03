import { prisma } from "@/lib/prisma"
import { notifyCustomer } from "@/lib/notify"
import { getSetting, getSettings } from "@/lib/settings"
import { waitlistOfferEmail } from "@/lib/email-templates"
import { checkVaccinationGate } from "@/lib/vaccination-gate"
import { findAvailableKennelUnit } from "@/lib/availability"

/** Marks past-due OFFERED entries as EXPIRED and offers the next person in line for the same service/date(s). */
export async function expireStaleOffers(): Promise<void> {
  const stale = await prisma.waitlistEntry.findMany({
    where: { status: "OFFERED", offerExpiresAt: { lt: new Date() } },
  })
  for (const entry of stale) {
    await prisma.waitlistEntry.update({ where: { id: entry.id }, data: { status: "EXPIRED" } })
    await offerNextInLine(entry.serviceId, entry.date, entry.endDate)
  }
}

/**
 * Offers the date/service slot to the first WAITING entry in line, if any.
 * `endDate` distinguishes a Home Boarding date range from a single-day
 * (Day Care / Meet & Greet) slot — pass `null`/omit for single-day services.
 */
export async function offerNextInLine(
  serviceId: string,
  date: Date,
  endDate?: Date | null
): Promise<void> {
  const next = await prisma.waitlistEntry.findFirst({
    where: { serviceId, date, endDate: endDate ?? null, status: "WAITING" },
    orderBy: { createdAt: "asc" },
    include: { customer: true, service: true, dog: true },
  })
  if (!next) return

  const hours = Number(await getSetting("waitlist_offer_hours", "12"))
  const offerExpiresAt = new Date(Date.now() + hours * 60 * 60 * 1000)

  await prisma.waitlistEntry.update({
    where: { id: next.id },
    data: { status: "OFFERED", offerExpiresAt },
  })

  const settings = await getSettings()
  const email = waitlistOfferEmail(settings, next.service.name, next.date, hours, next.endDate)
  const dateLabel = next.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  await notifyCustomer(next.customerId, "WAITLIST_OFFER", {
    subject: email.subject,
    html: email.html,
    smsBody: `A space opened up for ${next.service.name} on ${dateLabel} — claim within ${hours}h in your account.`,
  })
}

/**
 * Home Boarding waitlist entries are only ever created because a stay was
 * blocked by the vaccination gate at booking time (kennel availability
 * isn't the issue — see the "Join waiting list" prompt on that error in the
 * booking wizard), so nothing ever "frees up" for them the way cancellations
 * free capacity for Day Care/Meet & Greet. Call this after a customer adds a
 * vaccination record: if it now clears the gate for one of their WAITING
 * boarding entries and a kennel is still actually free for those dates,
 * offer it through the normal offer/claim flow (claiming re-validates the
 * vaccination gate and kennel availability again, so this is safe even if
 * something changed in between).
 */
export async function checkWaitlistAfterVaccination(dogId: string): Promise<void> {
  const entries = await prisma.waitlistEntry.findMany({
    where: { dogId, status: "WAITING", endDate: { not: null } },
  })
  for (const entry of entries) {
    const gate = await checkVaccinationGate([dogId], entry.endDate!)
    if (!gate.ok) continue
    const kennel = await findAvailableKennelUnit(entry.date, entry.endDate!, 1)
    if (!kennel) continue
    await offerNextInLine(entry.serviceId, entry.date, entry.endDate)
  }
}
