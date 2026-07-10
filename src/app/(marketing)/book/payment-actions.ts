"use server"

import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe, getSiteUrl } from "@/lib/stripe"

export type CheckoutState = { status: "error"; message: string }

async function ensureStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  if (user.stripeCustomerId) return user.stripeCustomerId

  const customer = await stripe!.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id },
  })
  await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } })
  return customer.id
}

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

  const customerId = await ensureStripeCustomer(session.user.id)
  const baseUrl = getSiteUrl()

  const checkoutSession = await stripe.checkout.sessions.create({
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
            name: `${type === "DEPOSIT" ? "Deposit" : "Balance"} — ${booking.service.name}`,
          },
        },
      },
    ],
    metadata: { bookingId: booking.id, type },
    success_url: `${baseUrl}/book/confirmation/${booking.id}?payment=success`,
    cancel_url: `${baseUrl}/book/confirmation/${booking.id}?payment=cancelled`,
  })

  if (!checkoutSession.url || !checkoutSession.payment_intent) {
    return { status: "error", message: "Could not start checkout. Please try again." }
  }

  await prisma.payment.create({
    data: {
      bookingId: booking.id,
      stripePaymentIntentId:
        typeof checkoutSession.payment_intent === "string"
          ? checkoutSession.payment_intent
          : checkoutSession.payment_intent.id,
      type,
      amountPence,
      status: "PENDING",
    },
  })

  redirect(checkoutSession.url)
}
