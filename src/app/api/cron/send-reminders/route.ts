import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSettings } from "@/lib/settings"
import { sendEmail } from "@/lib/email"
import { notifyCustomer } from "@/lib/notify"
import { formatPence, fullName } from "@/lib/format"
import { today, tomorrow } from "@/lib/staff-dates"
import { addDays } from "@/lib/dates"
import {
  balanceDueReminderEmail,
  checkinReminderEmail,
  vaccinationExpiryWarningEmail,
  bookingVaccinationRiskEmail,
  reviewRequestEmail,
  vaccinationReviewDigestEmail,
} from "@/lib/email-templates"
import { createBookingInvoice } from "@/lib/invoicing"
import { findAtRiskBookings } from "@/lib/booking-vaccination-risk"
import type { BookingStatus } from "@/generated/prisma/client"

// Bookings starting within this many days are scanned for lapsing
// vaccinations at all (the initial notice can fire any time inside this
// window); inside FINAL_NOTICE_DAYS of the stay, a firmer "may be
// cancelled" notice replaces it if the risk is still unresolved.
const AT_RISK_LOOKAHEAD_DAYS = 45
const AT_RISK_FINAL_NOTICE_DAYS = 7

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

// Unlike sendVaccinationExpiryWarnings above (any lapsing record, booking or
// not), this only fires for a dog with an already-confirmed upcoming
// booking that its current vaccinations won't cover through. Two-stage:
// an initial notice any time within the lookahead window, then a firmer
// final notice once the stay is close if it's still unresolved — each
// stage its own EmailLog type/bookingId pair, so both can fire once
// without either re-sending on its own.
async function sendBookingVaccinationRiskWarnings(settings: Record<string, string>) {
  const atRisk = await findAtRiskBookings(AT_RISK_LOOKAHEAD_DAYS)

  let sent = 0
  for (const { booking, perDog } of atRisk) {
    const daysOut = Math.round((booking.startDate.getTime() - today().getTime()) / 86_400_000)
    const stage = daysOut <= AT_RISK_FINAL_NOTICE_DAYS ? "FINAL" : "INITIAL"
    const logType = `BOOKING_VACCINATION_RISK_${stage}`
    if (await alreadySent(logType, { bookingId: booking.id })) continue

    const email = bookingVaccinationRiskEmail(settings, booking, perDog, stage === "FINAL")
    const dogList = perDog.map((d) => d.dogName).join(", ")
    await notifyCustomer(booking.customerId, "BOOKING_VACCINATION_RISK", {
      subject: email.subject,
      html: email.html,
      smsBody: `Action needed: vaccinations for ${dogList}'s ${booking.service.name} booking on ${booking.startDate.toLocaleDateString("en-GB")} need updating before check-in.`,
    })
    await prisma.emailLog.create({ data: { type: logType, bookingId: booking.id } })
    sent++
  }
  return sent
}

// One email per day summarizing the whole current UNVERIFIED backlog — not
// per-record dedup like the other reminders here, since this cron only runs
// once a day anyway (see vercel.json) and a record that's still unreviewed
// tomorrow should just appear in tomorrow's digest again rather than going
// silent after its first mention.
async function sendVaccinationReviewDigest(settings: Record<string, string>) {
  // "Send immediately" mode notifies per-upload instead (see
  // lib/vaccination-review-notify) — skip the digest so the same record
  // doesn't get reported twice.
  if (settings.vaccination_review_immediate === "true") return 0
  const recipient = settings.vaccination_review_email?.trim()
  if (!recipient) return 0

  const records = await prisma.vaccinationRecord.findMany({
    where: { status: "UNVERIFIED" },
    include: { dog: { include: { owner: true } } },
    orderBy: { expiryDate: "asc" },
  })
  if (records.length === 0) return 0

  const email = vaccinationReviewDigestEmail(
    settings,
    records.map((record) => ({
      dogName: record.dog.name,
      ownerName: fullName(record.dog.owner),
      type: record.type,
      dateGiven: record.dateGiven,
      expiryDate: record.expiryDate,
    }))
  )
  await sendEmail({ to: recipient, subject: email.subject, html: email.html })
  return records.length
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

// Invoice-after bookings for off-site services (e.g. dog walking) never pass
// through the staff check-in/check-out flow, so once the service date has
// passed, close them out and raise the invoice here. This also feeds them
// into the review-request flow above (which keys on CHECKED_OUT).
async function invoicePastServiceBookings() {
  const bookings = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      endDate: { lt: today() },
      service: { paymentTiming: "INVOICE_AFTER" },
    },
    select: { id: true },
  })

  let invoiced = 0
  for (const booking of bookings) {
    await prisma.booking.update({ where: { id: booking.id }, data: { status: "CHECKED_OUT" } })
    try {
      await createBookingInvoice(booking.id)
      invoiced++
    } catch (error) {
      // Booking is already CHECKED_OUT — admins can re-issue from the booking
      // page (Send invoice), so log rather than retry forever here.
      console.error(`[cron] failed to invoice booking ${booking.id}`, error)
    }
  }
  return invoiced
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

  // Close out finished invoice-after bookings before review requests run so
  // a booking invoiced today can also get its review request in the same run.
  const invoicedBookings = await invoicePastServiceBookings()

  const [
    balanceDueReminders,
    checkinReminders,
    vaccinationExpiryWarnings,
    bookingVaccinationRiskWarnings,
    vaccinationReviewDigest,
    reviewRequests,
  ] = await Promise.all([
    sendBalanceDueReminders(settings),
    sendCheckinReminders(settings),
    sendVaccinationExpiryWarnings(settings),
    sendBookingVaccinationRiskWarnings(settings),
    sendVaccinationReviewDigest(settings),
    sendReviewRequests(settings),
  ])

  return NextResponse.json({
    balanceDueReminders,
    checkinReminders,
    vaccinationExpiryWarnings,
    bookingVaccinationRiskWarnings,
    vaccinationReviewDigest,
    reviewRequests,
    invoicedBookings,
  })
}
