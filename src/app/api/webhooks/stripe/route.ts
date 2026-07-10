import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { getSettings } from "@/lib/settings"
import { bookingConfirmationEmail, paymentReceiptEmail } from "@/lib/email-templates"

async function markPaymentSucceededAndNotify(stripePaymentIntentId: string) {
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

  const receipt = paymentReceiptEmail(settings, bookingSummary, payment.amountPence, payment.type as "DEPOSIT" | "BALANCE")
  await sendEmail({ to: booking.customer.email, subject: receipt.subject, html: receipt.html })

  if (becameConfirmed) {
    const confirmation = bookingConfirmationEmail(settings, bookingSummary)
    await sendEmail({ to: booking.customer.email, subject: confirmation.subject, html: confirmation.html })
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id
  if (!paymentIntentId) return
  await markPaymentSucceededAndNotify(paymentIntentId)
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  await markPaymentSucceededAndNotify(paymentIntent.id)
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
