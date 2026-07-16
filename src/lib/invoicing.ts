import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { ensureStripeCustomer } from "@/lib/stripe-customer"
import { getSetting } from "@/lib/settings"

export type CreateInvoiceResult =
  | { status: "created"; hostedInvoiceUrl: string | null }
  | { status: "skipped"; reason: "stripe-not-configured" | "already-invoiced" | "nothing-due" }

/**
 * Creates and issues a Stripe invoice for a booking's outstanding balance.
 * Idempotent — safe to call from every check-out/completion transition point.
 *
 * Charges the customer's saved card automatically when one exists (cards are
 * saved by the Checkout flow via setup_future_usage); otherwise Stripe emails
 * a hosted invoice. A failed automatic charge also falls back to Stripe's
 * emailed invoice, so either path ends with the customer able to pay online.
 * The invoice.paid webhook marks the Payment SUCCEEDED and completes the
 * booking.
 */
export async function createBookingInvoice(bookingId: string): Promise<CreateInvoiceResult> {
  if (!stripe) return { status: "skipped", reason: "stripe-not-configured" }

  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { service: true, payments: true },
  })

  if (booking.payments.some((p) => p.type === "INVOICE" && p.status !== "FAILED")) {
    return { status: "skipped", reason: "already-invoiced" }
  }

  const paidPence = booking.payments
    .filter((p) => p.type !== "REFUND" && p.status === "SUCCEEDED")
    .reduce((sum, p) => sum + p.amountPence, 0)
  const outstandingPence = booking.totalPence - paidPence
  if (outstandingPence <= 0) return { status: "skipped", reason: "nothing-due" }

  const customerId = await ensureStripeCustomer(booking.customerId)

  const paymentMethods = await stripe.customers.listPaymentMethods(customerId, { limit: 1 })
  const savedPaymentMethod = paymentMethods.data[0]
  const daysUntilDue = Number(await getSetting("invoice_due_days", "7"))

  const dateRange =
    booking.startDate.toLocaleDateString("en-GB") +
    (booking.endDate.getTime() !== booking.startDate.getTime()
      ? ` – ${booking.endDate.toLocaleDateString("en-GB")}`
      : "")

  let invoice = await stripe.invoices.create({
    customer: customerId,
    ...(savedPaymentMethod
      ? { collection_method: "charge_automatically" as const, default_payment_method: savedPaymentMethod.id }
      : { collection_method: "send_invoice" as const, days_until_due: daysUntilDue }),
    auto_advance: true,
    metadata: { bookingId: booking.id },
  })
  await stripe.invoiceItems.create({
    customer: customerId,
    invoice: invoice.id,
    amount: outstandingPence,
    currency: "gbp",
    description: `${booking.service.name} (${dateRange})`,
  })
  invoice = await stripe.invoices.finalizeInvoice(invoice.id!)
  if (invoice.collection_method === "send_invoice" && invoice.status === "open") {
    invoice = await stripe.invoices.sendInvoice(invoice.id!)
  }

  await prisma.payment.create({
    data: {
      bookingId: booking.id,
      type: "INVOICE",
      amountPence: outstandingPence,
      status: "PENDING",
      stripeInvoiceId: invoice.id,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    },
  })

  return { status: "created", hostedInvoiceUrl: invoice.hosted_invoice_url ?? null }
}
