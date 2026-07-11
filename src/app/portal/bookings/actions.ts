"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getSetting, getSettings } from "@/lib/settings"
import { stripe } from "@/lib/stripe"
import { formatPence } from "@/lib/format"
import { sendEmail } from "@/lib/email"
import { cancellationConfirmationEmail, bookingConfirmationEmail, paymentReceiptEmail } from "@/lib/email-templates"
import { offerNextInLine } from "@/lib/waitlist"
import { redeemForCharge } from "@/lib/vouchers"

export type CancelBookingResult = { status: "success"; message: string } | { status: "error"; message: string }

const NON_CANCELLABLE_STATUSES = [
  "CHECKED_IN",
  "CHECKED_OUT",
  "COMPLETED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_ADMIN",
  "NO_SHOW",
]

type PolicyTier = "free" | "deposit_forfeit" | "no_refund"

async function refundPayment(
  bookingId: string,
  payment: { id: string; stripePaymentIntentId: string | null; amountPence: number }
) {
  if (!stripe || !payment.stripePaymentIntentId) return false
  try {
    await stripe.refunds.create({ payment_intent: payment.stripePaymentIntentId })
    await prisma.$transaction([
      prisma.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } }),
      prisma.payment.create({
        data: { bookingId, type: "REFUND", amountPence: payment.amountPence, status: "SUCCEEDED" },
      }),
    ])
    return true
  } catch (error) {
    console.error(`[cancelBooking] failed to refund payment ${payment.id}`, error)
    return false
  }
}

export async function cancelBooking(bookingId: string): Promise<CancelBookingResult> {
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
  const hoursUntilStart = (booking.startDate.getTime() - Date.now()) / (1000 * 60 * 60)

  let tier: PolicyTier
  if (hoursUntilStart >= freeDays * 24) {
    tier = "free"
  } else if (hoursUntilStart >= noRefundHours) {
    tier = "deposit_forfeit"
  } else {
    tier = "no_refund"
  }

  const successfulDeposit = booking.payments.find((p) => p.type === "DEPOSIT" && p.status === "SUCCEEDED")
  const successfulBalance = booking.payments.find((p) => p.type === "BALANCE" && p.status === "SUCCEEDED")

  let refundedPence = 0
  if (stripe) {
    if (tier === "free") {
      if (successfulDeposit && (await refundPayment(booking.id, successfulDeposit)))
        refundedPence += successfulDeposit.amountPence
      if (successfulBalance && (await refundPayment(booking.id, successfulBalance)))
        refundedPence += successfulBalance.amountPence
    } else if (tier === "deposit_forfeit") {
      if (successfulBalance && (await refundPayment(booking.id, successfulBalance)))
        refundedPence += successfulBalance.amountPence
    }
  }

  let policyNote: string
  if (tier === "free") {
    policyNote = stripe
      ? `Cancelled — this is outside the free cancellation window, so ${formatPence(refundedPence)} has been refunded.`
      : "Cancelled — this falls outside the free cancellation window, so a full refund applies once payments are enabled."
  } else if (tier === "deposit_forfeit") {
    policyNote = stripe
      ? `Cancelled — per our policy the deposit is forfeit. ${refundedPence > 0 ? `${formatPence(refundedPence)} of the balance has been refunded.` : ""}`
      : "Cancelled — per our policy the deposit is forfeit for cancellations within the free window."
  } else {
    policyNote = "Cancelled — per our policy no refund applies this close to the stay."
  }

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED_BY_CUSTOMER", cancellationReason: "Cancelled by customer" },
    }),
    prisma.kennelOccupancy.deleteMany({ where: { bookingId } }),
    prisma.walkBooking.deleteMany({ where: { bookingId } }),
    prisma.vanRunStop.deleteMany({ where: { bookingId } }),
  ])
  await offerNextInLine(booking.serviceId, booking.startDate)

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
  type: "DEPOSIT" | "BALANCE",
  code: string
): Promise<RedeemCreditResult> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Unauthorized" }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payments: true, service: true, customer: true },
  })
  if (!booking || booking.customerId !== session.user.id) {
    return { status: "error", message: "Booking not found." }
  }

  const alreadyPaid = booking.payments.some((p) => p.type === type && p.status === "SUCCEEDED")
  if (alreadyPaid) return { status: "error", message: "This has already been paid." }
  if (type === "BALANCE" && booking.status !== "CONFIRMED") {
    return { status: "error", message: "The deposit must be paid before the balance." }
  }

  const amountDuePence = type === "DEPOSIT" ? booking.depositPence : booking.totalPence - booking.depositPence
  if (amountDuePence <= 0) return { status: "error", message: "Nothing due." }

  const result = await redeemForCharge(session.user.id, booking.id, amountDuePence, code.trim() || undefined)
  if (!result.ok) return { status: "error", message: result.message }

  const becameConfirmed = type === "DEPOSIT" && booking.status === "PENDING_PAYMENT"
  await prisma.$transaction([
    prisma.payment.create({
      data: { bookingId: booking.id, type, amountPence: result.appliedPence, status: "SUCCEEDED" },
    }),
    ...(becameConfirmed ? [prisma.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED" } })] : []),
  ])

  const settings = await getSettings()
  const bookingSummary = {
    serviceName: booking.service.name,
    startDate: booking.startDate,
    endDate: booking.endDate,
    totalPence: booking.totalPence,
    depositPence: booking.depositPence,
  }
  const receipt = paymentReceiptEmail(settings, bookingSummary, result.appliedPence, type)
  await sendEmail({ to: booking.customer.email, subject: receipt.subject, html: receipt.html })
  if (becameConfirmed) {
    const confirmation = bookingConfirmationEmail(settings, bookingSummary)
    await sendEmail({ to: booking.customer.email, subject: confirmation.subject, html: confirmation.html })
  }

  revalidatePath("/portal/bookings")
  return { status: "success", message: "Payment covered by your credit/voucher." }
}
