"use server"

import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe, getSiteUrl } from "@/lib/stripe"
import { ensureStripeCustomer } from "@/lib/stripe-customer"

export type CheckoutState = { status: "error"; message: string }

export async function createCheckoutSession(
  bookingId: string,
  type: "DEPOSIT" | "BALANCE"
): Promise<CheckoutState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Please log in." }

  if (!stripe) {
    return {
      status: "error",
      message: "Online payment isn't enabled yet. Please contact us to arrange payment.",
    }
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: true, payments: true },
  })
  if (!booking || booking.customerId !== session.user.id) {
    return { status: "error", message: "Booking not found." }
  }

  if (booking.service.paymentTiming === "INVOICE_AFTER") {
    return {
      status: "error",
      message: "This service is invoiced after your visit — there's nothing to pay now.",
    }
  }

  const alreadyPaid = booking.payments.some((p) => p.type === type && p.status === "SUCCEEDED")
  if (alreadyPaid) {
    return { status: "error", message: "This has already been paid." }
  }

  if (type === "BALANCE" && booking.status !== "CONFIRMED") {
    return { status: "error", message: "The deposit must be paid before the balance." }
  }

  const amountPence = type === "DEPOSIT" ? booking.depositPence : booking.totalPence - booking.depositPence
  if (amountPence <= 0) {
    return { status: "error", message: "Nothing due." }
  }

  let customerId: string
  try {
    customerId = await ensureStripeCustomer(session.user.id)
  } catch (error) {
    console.error("[stripe checkout] ensureStripeCustomer failed", error)
    const detail = error instanceof Error ? error.message : String(error)
    return { status: "error", message: `Could not start checkout: ${detail}` }
  }
  const baseUrl = getSiteUrl()

  let checkoutSession
  try {
    checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      payment_intent_data: {
        setup_future_usage: "off_session",
        metadata: { bookingId: booking.id, type },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: amountPence,
            product_data: {
              name: `${
                type === "DEPOSIT"
                  ? booking.service.paymentTiming === "FULL_UPFRONT"
                    ? "Payment"
                    : "Deposit"
                  : "Balance"
              } — ${booking.service.name}`,
            },
          },
        },
      ],
      metadata: { bookingId: booking.id, type },
      success_url: `${baseUrl}/book/confirmation/${booking.id}?payment=success`,
      cancel_url: `${baseUrl}/book/confirmation/${booking.id}?payment=cancelled`,
    })
  } catch (error) {
    console.error("[stripe checkout] checkout.sessions.create failed", error)
    const detail = error instanceof Error ? error.message : String(error)
    return { status: "error", message: `Could not start checkout: ${detail}` }
  }

  if (!checkoutSession.url) {
    console.error("[stripe checkout] session missing url", checkoutSession)
    return { status: "error", message: "Could not start checkout. Please try again." }
  }

  // Stripe doesn't always populate payment_intent at session-creation time for
  // hosted Checkout — it may only appear once the customer completes payment.
  // Store the Checkout Session id as a placeholder key; the webhook reconciles
  // it with the real PaymentIntent id once checkout.session.completed fires.
  const paymentIntentId =
    typeof checkoutSession.payment_intent === "string"
      ? checkoutSession.payment_intent
      : checkoutSession.payment_intent?.id

  await prisma.payment.create({
    data: {
      bookingId: booking.id,
      stripePaymentIntentId: paymentIntentId ?? checkoutSession.id,
      type,
      amountPence,
      status: "PENDING",
    },
  })

  redirect(checkoutSession.url)
}
