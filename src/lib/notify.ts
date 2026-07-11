import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { sendSms } from "@/lib/sms"

export type NotificationType =
  | "PICKUP_DROPOFF"
  | "BALANCE_DUE_REMINDER"
  | "CHECKIN_REMINDER"
  | "WAITLIST_OFFER"

/**
 * Sends a customer notification on their preferred channel(s) (defaulting to
 * email-only when no NotificationPreference row exists) and logs every send
 * to MessageLog. SMS is silently skipped if the customer has no phone number
 * on file, even if their preference is SMS/BOTH.
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

  const channel = preference?.channel ?? "EMAIL"

  if (channel === "EMAIL" || channel === "BOTH") {
    await sendEmail({ to: customer.email, subject: content.subject, html: content.html })
    await prisma.messageLog.create({
      data: { customerId, channel: "EMAIL", type, payload: content.subject, status: "SENT" },
    })
  }

  if ((channel === "SMS" || channel === "BOTH") && customer.phone) {
    const sent = await sendSms(customer.phone, content.smsBody)
    await prisma.messageLog.create({
      data: { customerId, channel: "SMS", type, payload: content.smsBody, status: sent ? "SENT" : "FAILED" },
    })
  }
}
