import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { getSettings } from "@/lib/settings"
import { bookingConfirmationEmail, paymentReceiptEmail } from "@/lib/email-templates"

// Marks a Payment as SUCCEEDED (if not already), confirms the booking when a
// deposit is paid, and sends the receipt / confirmation emails. Idempotent —
// safe to call from both the Stripe webhook and the confirmation-page
// reconciliation, so whichever runs first wins and the other no-ops.
export async function markPaymentSucceededAndNotify(stripePaymentIntentId: string) {
  const payment = await prisma.payment.findUnique({ where: { stripePaymentIntentId } })
  if (!payment || payment.status === "SUCCEEDED") return // already processed or unknown

  await prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED" } })

  let becameConfirmed = false
  if (payment.type === "DEPOSIT") {
    const result = await prisma.booking.updateMany({
      where: { id: payment.bookingId, status: "PENDING_PAYMENT" },
      data: { status: "CONFIRMED" },
    })
    becameConfirmed = result.count > 0
  }

  const booking = await prisma.booking.findUnique({
    where: { id: payment.bookingId },
    include: { service: true, customer: true },
  })
  if (!booking) return

  const settings = await getSettings()
  const bookingSummary = {
    serviceName: booking.service.name,
    startDate: booking.startDate,
    endDate: booking.endDate,
    totalPence: booking.totalPence,
    depositPence: booking.depositPence,
  }

  const receipt = paymentReceiptEmail(
    settings,
    bookingSummary,
    payment.amountPence,
    payment.type as "DEPOSIT" | "BALANCE"
  )
  await sendEmail({ to: booking.customer.email, subject: receipt.subject, html: receipt.html })

  if (becameConfirmed) {
    const confirmation = bookingConfirmationEmail(settings, bookingSummary)
    await sendEmail({ to: booking.customer.email, subject: confirmation.subject, html: confirmation.html })
  }
}

// Fallback for when the Stripe webhook doesn't arrive (e.g. the endpoint isn't
// configured, or is delayed): ask Stripe directly whether the pending payments
// for a booking have completed, and reconcile any that have. Called when a
// customer views a still-PENDING_PAYMENT booking (e.g. returning from Stripe
// Checkout). No-ops safely if Stripe isn't configured or the session isn't
// found/paid.
export async function reconcilePendingBookingPayments(bookingId: string): Promise<void> {
  if (!stripe) return

  const payments = await prisma.payment.findMany({ where: { bookingId, status: "PENDING" } })

  for (const payment of payments) {
    const storedId = payment.stripePaymentIntentId
    if (!storedId) continue

    try {
      let paid = false
      let paymentIntentId: string | null = null

      if (storedId.startsWith("cs_")) {
        // Stored id is a Checkout Session placeholder — check the session.
        const checkoutSession = await stripe.checkout.sessions.retrieve(storedId)
        paid = checkoutSession.payment_status === "paid"
        paymentIntentId =
          typeof checkoutSession.payment_intent === "string"
            ? checkoutSession.payment_intent
            : (checkoutSession.payment_intent?.id ?? null)
      } else if (storedId.startsWith("pi_")) {
        const paymentIntent = await stripe.paymentIntents.retrieve(storedId)
        paid = paymentIntent.status === "succeeded"
        paymentIntentId = paymentIntent.id
      }

      if (!paid) continue

      // Reconcile the placeholder Checkout Session id with the real
      // PaymentIntent id so refunds/webhooks match this Payment later.
      if (paymentIntentId && payment.stripePaymentIntentId !== paymentIntentId) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { stripePaymentIntentId: paymentIntentId },
        })
      }

      const resolvedId = paymentIntentId ?? payment.stripePaymentIntentId
      if (resolvedId) await markPaymentSucceededAndNotify(resolvedId)
    } catch (error) {
      console.error(`[reconcile] could not reconcile payment ${payment.id}`, error)
    }
  }
}
