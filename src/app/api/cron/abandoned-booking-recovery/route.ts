import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSettings } from "@/lib/settings"
import { sendEmail } from "@/lib/email"
import { getSiteUrl } from "@/lib/stripe"
import { abandonedBookingReminderEmail, cancellationConfirmationEmail } from "@/lib/email-templates"
import { isOptedOut } from "@/lib/notification-preferences"
import { logAudit } from "@/lib/audit"
import { offerNextInLine } from "@/lib/waitlist"

// Releases the kennel/walk-slot/van-run-stop rows an abandoned PENDING_PAYMENT
// booking is still holding, so it stops permanently blocking capacity for
// everyone else. There's no dedicated "cancelled by system" BookingStatus
// value — reusing CANCELLED_BY_ADMIN (with a reason that says otherwise) was
// chosen over adding a new enum value + migration for this. Mirrors
// cancelBookingAdmin (admin/bookings/actions.ts) minus the refund step:
// a still-PENDING_PAYMENT booking can't have a SUCCEEDED deposit/balance
// payment to refund.
async function autoCancelAbandonedBooking(
  booking: {
    id: string
    serviceId: string
    startDate: Date
    service: { name: string }
    customer: { id: string; email: string; name: string }
    totalPence: number
    depositPence: number
    endDate: Date
  },
  settings: Awaited<ReturnType<typeof getSettings>>,
  autoCancelHours: number
) {
  const reason = `Automatically cancelled — deposit not paid within ${autoCancelHours} hours of booking.`

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED_BY_ADMIN", cancellationReason: reason, cancelledAt: new Date() },
    }),
    prisma.kennelOccupancy.deleteMany({ where: { bookingId: booking.id } }),
    prisma.walkBooking.deleteMany({ where: { bookingId: booking.id } }),
    prisma.vanRunStop.deleteMany({ where: { bookingId: booking.id } }),
  ])
  await offerNextInLine(booking.serviceId, booking.startDate)

  // Attributed to the customer, not an admin — same convention the
  // charge-balances cron uses for its own automated action, since
  // AuditLog.actorId is a required FK with no generic "system" actor.
  await logAudit({
    actorId: booking.customer.id,
    action: "CANCEL_BOOKING",
    entity: "Booking",
    entityId: booking.id,
    meta: `${booking.service.name} — ${reason} — owner ${booking.customer.name} <${booking.customer.email}>`,
  })

  const email = cancellationConfirmationEmail(
    settings,
    {
      serviceName: booking.service.name,
      startDate: booking.startDate,
      endDate: booking.endDate,
      totalPence: booking.totalPence,
      depositPence: booking.depositPence,
    },
    "Cancelled automatically because the deposit wasn't paid in time. Feel free to book again any time."
  )
  await sendEmail({ to: booking.customer.email, subject: email.subject, html: email.html })
}

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
  // Default 72h: comfortably after both nudges (2h/24h) so a genuinely
  // interested customer has had two emailed chances to pay before the
  // kennel/slot is released. Not admin-editable yet — same convention as
  // the two nudge-hour settings above, which also have no UI field.
  const autoCancelHours = Number(settings.abandoned_booking_auto_cancel_hours ?? "72")
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
  let autoCancelled = 0

  for (const booking of candidates) {
    const hoursSinceCreated = (now - booking.createdAt.getTime()) / (1000 * 60 * 60)

    // Checked before the opt-out/nudge logic below and unconditionally on
    // it — opting out of reminder emails doesn't exempt a booking from
    // releasing capacity it was never paid for.
    if (hoursSinceCreated >= autoCancelHours) {
      await autoCancelAbandonedBooking(booking, settings, autoCancelHours)
      autoCancelled++
      continue
    }

    if (await isOptedOut(booking.customerId, "ABANDONED_BOOKING_REMINDER")) continue

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

  return NextResponse.json({ firstNudges, secondNudges, autoCancelled })
}
