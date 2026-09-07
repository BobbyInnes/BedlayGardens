import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { sendSms } from "@/lib/sms"
import { derivePetCareUpdatesPreference } from "@/lib/notification-preferences"

export type NotificationType =
  | "PICKUP_DROPOFF"
  | "BALANCE_DUE_REMINDER"
  | "CHECKIN_REMINDER"
  | "WAITLIST_OFFER"
  | "WAITLIST_JOINED"
  | "VACCINATION_REVIEWED"
  | "BOOKING_VACCINATION_RISK"
  | "UPCOMING_BOOKING_REMINDER"

/**
 * Sends a customer notification on their "Pet Care Updates" channel(s) —
 * every NotificationType here falls in that notification-settings group,
 * gated per-channel via NotificationPreference (see
 * lib/notification-preferences.ts for the email/SMS default rules) — and
 * logs every send to MessageLog. SMS is silently skipped if the customer has
 * no phone number on file, even if their preference has SMS enabled.
 */
export async function notifyCustomer(
  customerId: string,
  type: NotificationType,
  content: { subject: string; html: string; smsBody: string }
): Promise<void> {
  const [preference, customer] = await Promise.all([
    prisma.notificationPreference.findUnique({ where: { customerId } }),
    prisma.user.findUnique({ where: { id: customerId } }),
  ])
  if (!customer) return

  const { email, sms } = derivePetCareUpdatesPreference(preference?.perType ?? null, preference?.channel ?? null)

  if (email) {
    await sendEmail({ to: customer.email, subject: content.subject, html: content.html })
    await prisma.messageLog.create({
      data: { customerId, channel: "EMAIL", type, payload: content.subject, status: "SENT" },
    })
  }

  if (sms && customer.phone) {
    const sent = await sendSms(customer.phone, content.smsBody)
    await prisma.messageLog.create({
      data: { customerId, channel: "SMS", type, payload: content.smsBody, status: sent ? "SENT" : "FAILED" },
    })
  }
}
