import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { getSettings } from "@/lib/settings"
import { paymentReceiptEmail, voucherDeliveryEmail } from "@/lib/email-templates"
import { notifySubscriptionPaymentFailed } from "@/lib/subscriptions"
import { markPaymentSucceededAndNotify } from "@/lib/payments"

async function handleVoucherCheckoutCompleted(voucherId: string) {
  const voucher = await prisma.voucher.findUnique({ where: { id: voucherId }, include: { purchaser: true } })
  if (!voucher || voucher.status !== "PENDING") return

  await prisma.voucher.update({ where: { id: voucherId }, data: { status: "ACTIVE" } })

  const settings = await getSettings()
  const recipientEmail = voucher.recipientEmail || voucher.purchaser?.email
  if (!recipientEmail) return
  const email = voucherDeliveryEmail(settings, voucher.code, voucher.amountPence, voucher.purchaser?.name ?? "A friend")
  await sendEmail({ to: recipientEmail, subject: email.subject, html: email.html })
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  if (session.metadata?.voucherId) {
    await handleVoucherCheckoutCompleted(session.metadata.voucherId)
    return
  }

  if (session.mode === "subscription") {
    const subscriptionId = session.metadata?.subscriptionId
    const stripeSubscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id
    if (!subscriptionId || !stripeSubscriptionId) return
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: "ACTIVE", stripeSubscriptionId },
    })
    return
  }

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id

  // createCheckoutSession may have stored the Checkout Session id as a placeholder
  // for stripePaymentIntentId if Stripe hadn't populated payment_intent yet at
  // creation time. Reconcile that placeholder with the real PaymentIntent id now.
  const pendingPayment = await prisma.payment.findUnique({ where: { stripePaymentIntentId: session.id } })
  if (pendingPayment && paymentIntentId && pendingPayment.stripePaymentIntentId !== paymentIntentId) {
    await prisma.payment.update({
      where: { id: pendingPayment.id },
      data: { stripePaymentIntentId: paymentIntentId },
    })
  }

  const resolvedPaymentIntentId = paymentIntentId ?? pendingPayment?.stripePaymentIntentId
  if (!resolvedPaymentIntentId) return
  await markPaymentSucceededAndNotify(resolvedPaymentIntentId)
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Only booking invoices carry bookingId metadata — subscription invoices
  // are handled by their own lifecycle and must not fall through to here.
  const bookingId = invoice.metadata?.bookingId
  if (!bookingId || !invoice.id) return

  const payment = await prisma.payment.findUnique({ where: { stripeInvoiceId: invoice.id } })
  if (!payment || payment.status === "SUCCEEDED") return // already processed or unknown

  // Backfill the PaymentIntent id so charge.refunded (and admin refunds,
  // which go through the PaymentIntent) reconcile against this Payment.
  let paymentIntentId: string | null = null
  try {
    const invoicePayments = await stripe!.invoicePayments.list({ invoice: invoice.id, status: "paid" })
    const pi = invoicePayments.data[0]?.payment.payment_intent
    paymentIntentId = typeof pi === "string" ? pi : (pi?.id ?? null)
  } catch (error) {
    console.error(`[stripe webhook] could not resolve payment intent for invoice ${invoice.id}`, error)
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "SUCCEEDED",
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    },
  })
  await prisma.booking.updateMany({
    where: { id: bookingId, status: "CHECKED_OUT" },
    data: { status: "COMPLETED" },
  })

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: true, customer: true },
  })
  if (!booking) return

  const settings = await getSettings()
  const receipt = paymentReceiptEmail(
    settings,
    {
      serviceName: booking.service.name,
      startDate: booking.startDate,
      endDate: booking.endDate,
      totalPence: booking.totalPence,
      depositPence: booking.depositPence,
    },
    payment.amountPence,
    "INVOICE"
  )
  await sendEmail({ to: booking.customer.email, subject: receipt.subject, html: receipt.html })
}

// Voided or written-off invoices are dead — stop showing them as collectable.
async function handleInvoiceDead(invoice: Stripe.Invoice) {
  if (!invoice.metadata?.bookingId || !invoice.id) return
  await prisma.payment.updateMany({
    where: { stripeInvoiceId: invoice.id, status: { not: "SUCCEEDED" } },
    data: { status: "FAILED" },
  })
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  // A failed charge on a booking invoice is not terminal: Stripe retries
  // automatically and falls back to emailing the hosted invoice, which
  // stays payable. The Payment row stays PENDING until paid or voided.
  if (invoice.metadata?.bookingId) return

  const subscriptionField = invoice.parent?.subscription_details?.subscription
  const stripeSubscriptionId =
    typeof subscriptionField === "string" ? subscriptionField : subscriptionField?.id
  if (!stripeSubscriptionId) return

  const subscription = await prisma.subscription.findFirst({ where: { stripeSubscriptionId } })
  if (!subscription || subscription.status !== "ACTIVE") return

  await notifySubscriptionPaymentFailed(subscription.id)
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
      case "invoice.paid":
        await handleInvoicePaid(event.data.object)
        break
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object)
        break
      case "invoice.voided":
      case "invoice.marked_uncollectible":
        await handleInvoiceDead(event.data.object)
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
