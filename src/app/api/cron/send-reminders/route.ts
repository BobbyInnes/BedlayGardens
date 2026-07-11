import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSettings } from "@/lib/settings"
import { sendEmail } from "@/lib/email"
import { notifyCustomer } from "@/lib/notify"
import { formatPence } from "@/lib/format"
import { today, tomorrow } from "@/lib/staff-dates"
import { addDays } from "@/lib/dates"
import {
  balanceDueReminderEmail,
  checkinReminderEmail,
  vaccinationExpiryWarningEmail,
  reviewRequestEmail,
} from "@/lib/email-templates"
import type { BookingStatus } from "@/generated/prisma/client"

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ["PENDING_PAYMENT", "CONFIRMED"]

async function alreadySent(type: string, key: { bookingId?: string; vaccinationRecordId?: string }) {
  const existing = await prisma.emailLog.findFirst({ where: { type, ...key } })
  return !!existing
}

async function sendBalanceDueReminders(settings: Record<string, string>) {
  const windowEnd = addDays(today(), 3)
  const bookings = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      balanceDueDate: { gte: today(), lte: windowEnd },
      payments: { none: { type: "BALANCE", status: "SUCCEEDED" } },
    },
    include: { service: true, customer: true },
  })

  let sent = 0
  for (const booking of bookings) {
    if (await alreadySent("BALANCE_DUE_REMINDER", { bookingId: booking.id })) continue

    const balancePence = booking.totalPence - booking.depositPence
    if (balancePence <= 0) continue

    const email = balanceDueReminderEmail(
      settings,
      {
        serviceName: booking.service.name,
        startDate: booking.startDate,
        endDate: booking.endDate,
        totalPence: booking.totalPence,
        depositPence: booking.depositPence,
      },
      balancePence
    )
    await notifyCustomer(booking.customerId, "BALANCE_DUE_REMINDER", {
      subject: email.subject,
      html: email.html,
      smsBody: `Balance of ${formatPence(balancePence)} is due soon for your ${booking.service.name} booking.`,
    })
    await prisma.emailLog.create({ data: { type: "BALANCE_DUE_REMINDER", bookingId: booking.id } })
    sent++
  }
  return sent
}

async function sendCheckinReminders(settings: Record<string, string>) {
  const bookings = await prisma.booking.findMany({
    where: {
      startDate: tomorrow(),
      status: { in: ACTIVE_BOOKING_STATUSES },
    },
    include: { service: true, customer: true, bookingDogs: { include: { dog: true } } },
  })

  let sent = 0
  for (const booking of bookings) {
    if (await alreadySent("CHECKIN_REMINDER", { bookingId: booking.id })) continue

    const email = checkinReminderEmail(
      settings,
      {
        serviceName: booking.service.name,
        startDate: booking.startDate,
        endDate: booking.endDate,
        totalPence: booking.totalPence,
        depositPence: booking.depositPence,
      },
      booking.bookingDogs.map((bd) => bd.dog.name)
    )
    const dogNames = booking.bookingDogs.map((bd) => bd.dog.name).join(", ")
    await notifyCustomer(booking.customerId, "CHECKIN_REMINDER", {
      subject: email.subject,
      html: email.html,
      smsBody: `Reminder: ${dogNames} checks in tomorrow for ${booking.service.name}.`,
    })
    await prisma.emailLog.create({ data: { type: "CHECKIN_REMINDER", bookingId: booking.id } })
    sent++
  }
  return sent
}

async function sendVaccinationExpiryWarnings(settings: Record<string, string>) {
  const windowEnd = addDays(today(), 14)
  const records = await prisma.vaccinationRecord.findMany({
    where: {
      status: { not: "EXPIRED" },
      expiryDate: { gte: today(), lte: windowEnd },
    },
    include: { dog: { include: { owner: true } } },
  })

  let sent = 0
  for (const record of records) {
    if (await alreadySent("VACCINATION_EXPIRY_WARNING", { vaccinationRecordId: record.id })) continue

    const email = vaccinationExpiryWarningEmail(settings, record.dog.name, record.type, record.expiryDate)
    await sendEmail({ to: record.dog.owner.email, subject: email.subject, html: email.html })
    await prisma.emailLog.create({
      data: { type: "VACCINATION_EXPIRY_WARNING", vaccinationRecordId: record.id },
    })
    sent++
  }
  return sent
}

async function sendReviewRequests(settings: Record<string, string>) {
  const cutoff = addDays(today(), -1)
  const bookings = await prisma.booking.findMany({
    where: {
      status: "CHECKED_OUT",
      endDate: { lte: cutoff },
      review: null,
    },
    include: { service: true, customer: true, bookingDogs: { include: { dog: true } } },
  })

  let sent = 0
  for (const booking of bookings) {
    if (await alreadySent("REVIEW_REQUEST", { bookingId: booking.id })) continue

    const dogName = booking.bookingDogs[0]?.dog.name ?? "your dog"
    const email = reviewRequestEmail(settings, booking.service.name, dogName)
    await sendEmail({ to: booking.customer.email, subject: email.subject, html: email.html })
    await prisma.emailLog.create({ data: { type: "REVIEW_REQUEST", bookingId: booking.id } })
    sent++
  }
  return sent
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

  const [balanceDueReminders, checkinReminders, vaccinationExpiryWarnings, reviewRequests] = await Promise.all([
    sendBalanceDueReminders(settings),
    sendCheckinReminders(settings),
    sendVaccinationExpiryWarnings(settings),
    sendReviewRequests(settings),
  ])

  return NextResponse.json({ balanceDueReminders, checkinReminders, vaccinationExpiryWarnings, reviewRequests })
}
