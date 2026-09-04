"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit, describeBooking } from "@/lib/audit"
import { getSetting, getSettings } from "@/lib/settings"
import { getVatSettings } from "@/lib/vat"
import { stripe, getSiteUrl } from "@/lib/stripe"
import { formatPence, fullName } from "@/lib/format"
import { sendEmail } from "@/lib/email"
import {
  cancellationConfirmationEmail,
  bookingConfirmationEmail,
  paymentReceiptEmail,
  pendingVaccinationEmail,
} from "@/lib/email-templates"
import { checkVaccinationGate } from "@/lib/vaccination-gate"
import { offerNextInLine } from "@/lib/waitlist"
import { redeemForCharge } from "@/lib/vouchers"
import { getCancellationTier } from "@/lib/cancellation-policy"
import { refundPayment } from "@/lib/payments"

export type CancelBookingResult = { status: "success"; message: string } | { status: "error"; message: string }

const NON_CANCELLABLE_STATUSES = [
  "CHECKED_IN",
  "CHECKED_OUT",
  "COMPLETED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_ADMIN",
  "NO_SHOW",
]

export async function cancelBooking(bookingId: string, reason?: string): Promise<CancelBookingResult> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Unauthorized" }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payments: true, service: true, customer: true },
  })
  if (!booking || booking.customerId !== session.user.id) {
    return { status: "error", message: "Booking not found." }
  }
  if (NON_CANCELLABLE_STATUSES.includes(booking.status)) {
    return { status: "error", message: "This booking can no longer be cancelled." }
  }

  const freeDays = Number(await getSetting("cancellation_free_days", "14"))
  const noRefundHours = Number(await getSetting("cancellation_no_refund_hours", "48"))
  const tier = getCancellationTier(booking.startDate, freeDays, noRefundHours)

  const successfulDeposit = booking.payments.find((p) => p.type === "DEPOSIT" && p.status === "SUCCEEDED")
  const successfulBalance = booking.payments.find((p) => p.type === "BALANCE" && p.status === "SUCCEEDED")

  let refundedPence = 0
  if (stripe) {
    if (tier === "free") {
      if (successfulDeposit && (await refundPayment(booking.id, successfulDeposit, booking.batchId)))
        refundedPence += successfulDeposit.amountPence
      if (successfulBalance && (await refundPayment(booking.id, successfulBalance, booking.batchId)))
        refundedPence += successfulBalance.amountPence
    } else if (tier === "deposit_forfeit") {
      if (successfulBalance && (await refundPayment(booking.id, successfulBalance, booking.batchId)))
        refundedPence += successfulBalance.amountPence
    }
  }

  let policyNote: string
  if (tier === "free") {
    policyNote = stripe
      ? `Cancelled — this is within the free cancellation window, so ${formatPence(refundedPence)} has been refunded.`
      : "Cancelled — this falls within the free cancellation window, so a full refund applies once payments are enabled."
  } else if (tier === "deposit_forfeit") {
    policyNote = stripe
      ? `Cancelled — per our policy the deposit is forfeit. ${refundedPence > 0 ? `${formatPence(refundedPence)} of the balance has been refunded.` : ""}`
      : "Cancelled — per our policy the deposit is forfeit for cancellations within the free window."
  } else {
    policyNote = "Cancelled — per our policy no refund applies this close to the stay."
  }

  const cancelledAt = new Date()
  const trimmedReason = reason?.trim() || null

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "CANCELLED_BY_CUSTOMER",
        cancellationReason: trimmedReason,
        cancelledAt,
      },
    }),
    prisma.kennelOccupancy.deleteMany({ where: { bookingId } }),
    prisma.walkBooking.deleteMany({ where: { bookingId } }),
    prisma.vanRunStop.deleteMany({ where: { bookingId } }),
  ])
  await offerNextInLine(booking.serviceId, booking.startDate)

  await logAudit({
    actorId: session.user.id,
    action: "CANCEL_BOOKING",
    entity: "Booking",
    entityId: bookingId,
    meta: `${booking.service.name} — ${trimmedReason ?? "No reason given"}`,
  })

  const settings = await getSettings()
  const email = cancellationConfirmationEmail(
    settings,
    {
      serviceName: booking.service.name,
      startDate: booking.startDate,
      endDate: booking.endDate,
      totalPence: booking.totalPence,
      depositPence: booking.depositPence,
    },
    policyNote
  )
  await sendEmail({ to: booking.customer.email, subject: email.subject, html: email.html })

  revalidatePath("/portal/bookings")
  return { status: "success", message: policyNote }
}

export type RedeemCreditResult = { status: "success"; message: string } | { status: "error"; message: string }

export async function redeemCreditForPayment(
  bookingId: string,
  // "FULL" covers the deposit AND the balance in one redemption — only
  // valid pre-deposit (same window as "DEPOSIT"), for a customer who'd
  // rather settle a deposit-then-balance booking in one go than come back
  // for the balance later. Recorded as two Payment rows (DEPOSIT + BALANCE)
  // since the rest of the app reads "paid" as a boolean per type, not a
  // running total — mirrors how FULL_UPFRONT services already just set
  // depositPence to the full total rather than needing a third Payment type.
  type: "DEPOSIT" | "BALANCE" | "FULL",
  code: string
): Promise<RedeemCreditResult> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Unauthorized" }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      payments: true,
      service: true,
      customer: true,
      bookingDogs: { include: { dog: true } },
      bookingAddons: { include: { addon: true } },
    },
  })
  if (!booking || booking.customerId !== session.user.id) {
    return { status: "error", message: "Booking not found." }
  }

  const depositPaid = booking.payments.some((p) => p.type === "DEPOSIT" && p.status === "SUCCEEDED")
  const balancePaid = booking.payments.some((p) => p.type === "BALANCE" && p.status === "SUCCEEDED")
  if (type === "BALANCE") {
    if (balancePaid) return { status: "error", message: "This has already been paid." }
    if (booking.status !== "CONFIRMED") {
      return { status: "error", message: "The deposit must be paid before the balance." }
    }
  } else {
    // DEPOSIT and FULL both need the deposit stage still open.
    if (depositPaid) return { status: "error", message: "This has already been paid." }
  }

  const balancePence = booking.totalPence - booking.depositPence
  const amountDuePence =
    type === "DEPOSIT" ? booking.depositPence : type === "BALANCE" ? balancePence : booking.totalPence
  if (amountDuePence <= 0) return { status: "error", message: "Nothing due." }

  const result = await redeemForCharge(session.user.id, booking.id, amountDuePence, code.trim() || undefined)
  if (!result.ok) return { status: "error", message: result.message }

  // Same re-check as the Stripe payment-success path (see
  // markPaymentSucceededAndNotify in lib/payments.ts) — redeeming credit
  // shouldn't confirm a booking past a vaccination gate that's still failing.
  const willAttemptConfirm = type !== "BALANCE" && booking.status === "PENDING_PAYMENT"
  const gateNowOk = willAttemptConfirm
    ? (await checkVaccinationGate(booking.bookingDogs.map((bd) => bd.dogId), booking.endDate)).ok
    : false
  const becameConfirmed = willAttemptConfirm && gateNowOk
  const becamePendingVaccination = willAttemptConfirm && !gateNowOk
  const now = new Date()
  await prisma.$transaction([
    prisma.payment.create({
      data: {
        bookingId: booking.id,
        type: type === "FULL" ? "DEPOSIT" : type,
        amountPence: type === "FULL" ? booking.depositPence : result.appliedPence,
        status: "SUCCEEDED",
        succeededAt: now,
      },
    }),
    ...(type === "FULL" && balancePence > 0
      ? [
          prisma.payment.create({
            data: { bookingId: booking.id, type: "BALANCE", amountPence: balancePence, status: "SUCCEEDED", succeededAt: now },
          }),
        ]
      : []),
    ...(willAttemptConfirm
      ? [
          prisma.booking.update({
            where: { id: booking.id },
            data: { status: gateNowOk ? "CONFIRMED" : "PENDING_VACCINATION" },
          }),
        ]
      : []),
  ])

  await logAudit({
    actorId: session.user.id,
    action: "PAYMENT_SUCCEEDED",
    entity: "Booking",
    entityId: booking.id,
    meta: `${type} — ${formatPence(result.appliedPence)} (credit/voucher) — ${describeBooking(booking)}`,
  })

  const settings = await getSettings()
  const vat = await getVatSettings()
  const bookingSummary = {
    bookingId: booking.id,
    bookingNumber: booking.bookingNumber,
    customerName: fullName(booking.customer),
    serviceName: booking.service.name,
    startDate: booking.startDate,
    endDate: booking.endDate,
    totalPence: booking.totalPence,
    depositPence: booking.depositPence,
    balanceDueDate: booking.balanceDueDate,
    dogNames: booking.bookingDogs.map((bd) => bd.dog.name),
    customerNumber: booking.customer.customerNumber,
  }
  const receipt = await paymentReceiptEmail(
    settings,
    bookingSummary,
    result.appliedPence,
    type,
    `${getSiteUrl()}/portal/bookings`,
    vat
  )
  await sendEmail({ to: booking.customer.email, subject: receipt.subject, html: receipt.html })
  // DEPOSIT_THEN_BALANCE bookings already got the deposit-invoice email at
  // creation — see the matching guard in payments.ts.
  if (becameConfirmed && booking.service.paymentTiming !== "DEPOSIT_THEN_BALANCE") {
    const confirmation = await bookingConfirmationEmail(
      settings,
      {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        customerName: fullName(booking.customer),
        serviceSlug: booking.service.slug,
        serviceName: booking.service.name,
        paymentTiming: booking.service.paymentTiming,
        startDate: booking.startDate,
        endDate: booking.endDate,
        totalPence: booking.totalPence,
        depositPence: booking.depositPence,
        balanceDueDate: booking.balanceDueDate,
        dogNames: booking.bookingDogs.map((bd) => bd.dog.name),
        customerNumber: booking.customer.customerNumber,
        addons: booking.bookingAddons.map((ba) => ({
          name: ba.addon.name,
          quantity: ba.quantity,
          totalPence: ba.pricePence,
        })),
      },
      vat,
      `${getSiteUrl()}/portal/bookings`
    )
    await sendEmail({ to: booking.customer.email, subject: confirmation.subject, html: confirmation.html })
  }

  if (becamePendingVaccination) {
    const gate = await checkVaccinationGate(booking.bookingDogs.map((bd) => bd.dogId), booking.endDate)
    const missingSummary = gate.perDog
      .filter((d) => d.missingTypes.length > 0)
      .map((d) => `${d.dogName} (${d.missingTypes.join(", ")})`)
      .join("; ")
    const pending = pendingVaccinationEmail(
      settings,
      { serviceName: booking.service.name, startDate: booking.startDate },
      missingSummary,
      "initial"
    )
    await sendEmail({ to: booking.customer.email, subject: pending.subject, html: pending.html })
  }

  revalidatePath("/portal/bookings")
  return {
    status: "success",
    message:
      type === "FULL" ? "Booking paid in full with your credit/voucher." : "Payment covered by your credit/voucher.",
  }
}
