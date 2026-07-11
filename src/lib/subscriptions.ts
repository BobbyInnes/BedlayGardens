import { prisma } from "@/lib/prisma"
import { startOfDay, addDays, toDateInputValue } from "@/lib/dates"
import { resolveBookingCreation } from "@/app/(marketing)/book/actions"
import { notifyCustomer } from "@/lib/notify"
import { sendEmail } from "@/lib/email"
import { getSettings, getSetting } from "@/lib/settings"

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

export function parseWeekdays(weekdays: string): number[] {
  return weekdays
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((d) => !Number.isNaN(d))
}

/**
 * For each ACTIVE subscription whose weekday matches `forDate` and isn't
 * currently paused, creates the underlying booking if one doesn't already
 * exist for that dog/service/date — same gates (agreement, vaccination,
 * capacity) as a normal booking, via `resolveBookingCreation`. Only
 * `daycare` subscriptions auto-generate: `dog-walking` needs a matching
 * VanRun + pickup address that the Subscription model doesn't capture, so
 * those rows exist for admin/billing visibility but aren't auto-booked.
 */
export async function generateBookingsForActiveSubscriptions(forDate: Date): Promise<number> {
  const day = startOfDay(forDate)
  const weekday = day.getDay()

  const subscriptions = await prisma.subscription.findMany({
    where: { status: "ACTIVE", service: { slug: "daycare" } },
    include: { service: true },
  })

  let created = 0
  for (const sub of subscriptions) {
    if (!parseWeekdays(sub.weekdays).includes(weekday)) continue
    if (sub.pausedUntil && sub.pausedUntil >= day) continue

    const existing = await prisma.booking.findFirst({
      where: {
        customerId: sub.customerId,
        serviceId: sub.serviceId,
        startDate: day,
        bookingDogs: { some: { dogId: sub.dogId } },
      },
    })
    if (existing) continue

    const result = await resolveBookingCreation(sub.customerId, {
      serviceSlug: sub.service.slug,
      dogIds: [sub.dogId],
      addons: [],
      date: toDateInputValue(day),
    })
    if (result.status === "idle") created++
  }
  return created
}

export async function pauseSubscription(subscriptionId: string, pausedUntil: Date): Promise<{ ok: boolean; message?: string }> {
  const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } })
  if (!subscription) return { ok: false, message: "Subscription not found." }

  const noticeDays = Number(await getSetting("subscription_pause_notice_days", "3"))
  const earliestAllowed = addDays(startOfDay(new Date()), noticeDays)
  if (startOfDay(pausedUntil) < earliestAllowed) {
    return { ok: false, message: `Pausing requires at least ${noticeDays} days' notice.` }
  }

  await prisma.subscription.update({ where: { id: subscriptionId }, data: { status: "PAUSED", pausedUntil } })
  return { ok: true }
}

export async function notifySubscriptionPaymentFailed(subscriptionId: string): Promise<void> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { customer: true, service: true, dog: true },
  })
  if (!subscription) return

  await prisma.subscription.update({ where: { id: subscriptionId }, data: { status: "PAST_DUE" } })

  const settings = await getSettings()
  await notifyCustomer(subscription.customerId, "BALANCE_DUE_REMINDER", {
    subject: `Payment failed — ${subscription.service.name} subscription paused`,
    html: `<p>We couldn't take payment for ${subscription.dog.name}'s ${subscription.service.name} subscription, so it's been paused. Please update your payment details and resume it from your account.</p>`,
    smsBody: `Payment failed for ${subscription.dog.name}'s ${subscription.service.name} subscription — it's been paused. Check your account.`,
  })

  const adminEmail = settings.business_email
  if (adminEmail) {
    await sendEmail({
      to: adminEmail,
      subject: `Subscription payment failed — ${subscription.customer.name}`,
      html: `<p>${subscription.customer.name}'s ${subscription.service.name} subscription for ${subscription.dog.name} has been paused after a failed payment.</p>`,
    })
  }
}
