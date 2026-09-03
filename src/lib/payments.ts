import { stripe, getSiteUrl } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { logAudit, describeBooking } from "@/lib/audit"
import { sendEmail } from "@/lib/email"
import { getSettings } from "@/lib/settings"
import { getVatSettings } from "@/lib/vat"
import { formatPence, fullName } from "@/lib/format"
import { bookingConfirmationEmail, paymentReceiptEmail, pendingVaccinationEmail } from "@/lib/email-templates"
import { checkVaccinationGate } from "@/lib/vaccination-gate"

// Marks a Payment as SUCCEEDED (if not already), confirms the booking when a
// deposit is paid, and sends the receipt / confirmation emails. Idempotent —
// safe to call from both the Stripe webhook and the confirmation-page
// reconciliation, so whichever runs first wins and the other no-ops.
export async function markPaymentSucceededAndNotify(stripePaymentIntentId: string) {
  const payment = await prisma.payment.findUnique({ where: { stripePaymentIntentId } })
  if (!payment || payment.status === "SUCCEEDED") return // already processed or unknown

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "SUCCEEDED", succeededAt: new Date() },
  })

  let becameConfirmed = false
  let becamePendingVaccination = false
  if (payment.type === "DEPOSIT") {
    // Re-check the vaccination gate now, rather than assuming it still
    // passes from booking time — it may have lapsed in the meantime, or
    // (for a booking placed via proceedWithoutValidVaccines) may now pass
    // if a certificate was uploaded while payment was in flight. Only acts
    // on a booking still PENDING_PAYMENT — already-decided bookings (e.g.
    // reconciliation racing the webhook) are left alone.
    const pending = await prisma.booking.findFirst({
      where: { id: payment.bookingId, status: "PENDING_PAYMENT" },
      include: { bookingDogs: true },
    })
    if (pending) {
      const gate = await checkVaccinationGate(
        pending.bookingDogs.map((bd) => bd.dogId),
        pending.endDate
      )
      const newStatus = gate.ok ? "CONFIRMED" : "PENDING_VACCINATION"
      await prisma.booking.update({ where: { id: pending.id }, data: { status: newStatus } })
      becameConfirmed = newStatus === "CONFIRMED"
      becamePendingVaccination = newStatus === "PENDING_VACCINATION"
    }
  }

  const booking = await prisma.booking.findUnique({
    where: { id: payment.bookingId },
    include: {
      service: true,
      customer: true,
      bookingDogs: { include: { dog: true } },
      bookingAddons: { include: { addon: true } },
    },
  })
  if (!booking) return

  // A "pay in full" checkout (see createCheckoutSession) is stored as a
  // single DEPOSIT-typed row for the whole amount, since Stripe only gives
  // one PaymentIntent per session and PaymentType has no "FULL" value. Once
  // it succeeds, split it into a proper DEPOSIT + BALANCE pair — everything
  // else in the app (outstanding-balance calculations, "pay balance"
  // buttons, etc.) reads paid-ness as a boolean per type, not a running
  // total, so a lone inflated DEPOSIT row would leave the balance looking
  // unpaid and still promptable. Mirrors redeemCreditForPayment's own
  // DEPOSIT+BALANCE split for its "FULL" credit-redemption option.
  const wasFullPayment = payment.type === "DEPOSIT" && payment.amountPence > booking.depositPence
  const receiptAmountPence = payment.amountPence
  if (wasFullPayment) {
    const balancePence = booking.totalPence - booking.depositPence
    await prisma.payment.update({
      where: { id: payment.id },
      data: { amountPence: booking.depositPence },
    })
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        type: "BALANCE",
        amountPence: balancePence,
        status: "SUCCEEDED",
        succeededAt: new Date(),
      },
    })
  }

  await logAudit({
    actorId: booking.customer.id,
    action: "PAYMENT_SUCCEEDED",
    entity: "Booking",
    entityId: booking.id,
    meta: `${wasFullPayment ? "FULL" : payment.type} — ${formatPence(payment.amountPence)} — ${describeBooking(booking)}`,
  })

  const settings = await getSettings()
  const vat = await getVatSettings()
  const otherDaycareDates = booking.batchId
    ? (
        await prisma.booking.findMany({
          where: { batchId: booking.batchId, id: { not: booking.id } },
          select: { startDate: true },
        })
      ).map((b) => b.startDate)
    : []
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
    otherDaycareDates,
    customerNumber: booking.customer.customerNumber,
  }

  const receipt = await paymentReceiptEmail(
    settings,
    bookingSummary,
    receiptAmountPence,
    wasFullPayment ? "FULL" : (payment.type as "DEPOSIT" | "BALANCE"),
    `${getSiteUrl()}/portal/bookings`,
    vat
  )
  await sendEmail({ to: booking.customer.email, subject: receipt.subject, html: receipt.html })

  // DEPOSIT_THEN_BALANCE bookings already got the deposit-invoice email at
  // creation (see resolveBookingCreation in (marketing)/book/actions.ts) —
  // sending this post-payment invoice too would be a second invoice-style
  // email for the same booking. FULL_UPFRONT bookings get no email at
  // creation, so they still need this one once payment clears.
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
        otherDaycareDates,
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
    const gate = await checkVaccinationGate(
      booking.bookingDogs.map((bd) => bd.dogId),
      booking.endDate
    )
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
