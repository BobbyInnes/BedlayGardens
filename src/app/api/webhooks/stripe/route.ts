import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id
  if (!paymentIntentId) return

  const payment = await prisma.payment.findUnique({ where: { stripePaymentIntentId: paymentIntentId } })
  if (!payment || payment.status === "SUCCEEDED") return // already processed or unknown

  await prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED" } })

  if (payment.type === "DEPOSIT") {
    await prisma.booking.updateMany({
      where: { id: payment.bookingId, status: "PENDING_PAYMENT" },
      data: { status: "CONFIRMED" },
    })
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const payment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: paymentIntent.id },
  })
  if (!payment || payment.status === "SUCCEEDED") return

  await prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED" } })

  if (payment.type === "DEPOSIT") {
    await prisma.booking.updateMany({
      where: { id: payment.bookingId, status: "PENDING_PAYMENT" },
      data: { status: "CONFIRMED" },
    })
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  await prisma.payment.updateMany({
    where: { stripePaymentIntentId: paymentIntent.id, status: { not: "SUCCEEDED" } },
    data: { status: "FAILED" },
  })
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id
  if (!paymentIntentId) return

  await prisma.payment.updateMany({
    where: { stripePaymentIntentId: paymentIntentId },
    data: { status: "REFUNDED" },
  })
}

export async function POST(request: Request) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 400 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (error) {
    console.error("[stripe webhook] signature verification failed", error)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object)
        break
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object)
        break
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object)
        break
      case "charge.refunded":
        await handleChargeRefunded(event.data.object)
        break
      default:
        break
    }
  } catch (error) {
    console.error(`[stripe webhook] failed to handle ${event.type}`, error)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
