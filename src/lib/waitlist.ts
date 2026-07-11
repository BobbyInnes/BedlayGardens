import { prisma } from "@/lib/prisma"
import { notifyCustomer } from "@/lib/notify"
import { getSetting, getSettings } from "@/lib/settings"
import { waitlistOfferEmail } from "@/lib/email-templates"

/** Marks past-due OFFERED entries as EXPIRED and offers the next person in line for the same service/date. */
export async function expireStaleOffers(): Promise<void> {
  const stale = await prisma.waitlistEntry.findMany({
    where: { status: "OFFERED", offerExpiresAt: { lt: new Date() } },
  })
  for (const entry of stale) {
    await prisma.waitlistEntry.update({ where: { id: entry.id }, data: { status: "EXPIRED" } })
    await offerNextInLine(entry.serviceId, entry.date)
  }
}

/** Offers the date/service slot to the first WAITING entry in line, if any. */
export async function offerNextInLine(serviceId: string, date: Date): Promise<void> {
  const next = await prisma.waitlistEntry.findFirst({
    where: { serviceId, date, status: "WAITING" },
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
  const email = waitlistOfferEmail(settings, next.service.name, next.date, hours)
  const dateLabel = next.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  await notifyCustomer(next.customerId, "WAITLIST_OFFER", {
    subject: email.subject,
    html: email.html,
    smsBody: `A space opened up for ${next.service.name} on ${dateLabel} — claim within ${hours}h in your account.`,
  })
}
