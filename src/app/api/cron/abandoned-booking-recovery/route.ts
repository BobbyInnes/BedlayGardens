import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSettings } from "@/lib/settings"
import { sendEmail } from "@/lib/email"
import { getSiteUrl } from "@/lib/stripe"
import { abandonedBookingReminderEmail } from "@/lib/email-templates"
import { isOptedOut } from "@/lib/notification-preferences"

async function alreadySent(type: string, bookingId: string) {
  const existing = await prisma.emailLog.findFirst({ where: { type, bookingId } })
  return !!existing
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 400 })
  }
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const settings = await getSettings()
  const firstNudgeHours = Number(settings.abandoned_booking_reminder_hours ?? "2")
  const secondNudgeHours = Number(settings.abandoned_booking_second_nudge_hours ?? "24")
  const baseUrl = getSiteUrl()
  const now = Date.now()

  const candidates = await prisma.booking.findMany({
    where: {
      status: "PENDING_PAYMENT",
      createdAt: { lte: new Date(now - firstNudgeHours * 60 * 60 * 1000) },
    },
    include: { service: true, customer: true },
  })

  let firstNudges = 0
  let secondNudges = 0

  for (const booking of candidates) {
    if (await isOptedOut(booking.customerId, "ABANDONED_BOOKING_REMINDER")) continue

    const hoursSinceCreated = (now - booking.createdAt.getTime()) / (1000 * 60 * 60)
    const resumeUrl = `${baseUrl}/book/confirmation/${booking.id}`
    const bookingSummary = {
      serviceName: booking.service.name,
      startDate: booking.startDate,
      endDate: booking.endDate,
      totalPence: booking.totalPence,
      depositPence: booking.depositPence,
    }

    if (!(await alreadySent("ABANDONED_BOOKING_REMINDER_1", booking.id))) {
      const email = abandonedBookingReminderEmail(settings, bookingSummary, resumeUrl, false)
      await sendEmail({ to: booking.customer.email, subject: email.subject, html: email.html })
      await prisma.emailLog.create({ data: { type: "ABANDONED_BOOKING_REMINDER_1", bookingId: booking.id } })
      firstNudges++
      continue
    }

    if (hoursSinceCreated >= secondNudgeHours && !(await alreadySent("ABANDONED_BOOKING_REMINDER_2", booking.id))) {
      const email = abandonedBookingReminderEmail(settings, bookingSummary, resumeUrl, true)
      await sendEmail({ to: booking.customer.email, subject: email.subject, html: email.html })
      await prisma.emailLog.create({ data: { type: "ABANDONED_BOOKING_REMINDER_2", bookingId: booking.id } })
      secondNudges++
    }
  }

  return NextResponse.json({ firstNudges, secondNudges })
}
