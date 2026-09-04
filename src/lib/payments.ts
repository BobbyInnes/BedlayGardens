import { stripe, getSiteUrl } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { logAudit, describeBooking } from "@/lib/audit"
import { sendEmail } from "@/lib/email"
import { getSettings } from "@/lib/settings"
import { getVatSettings } from "@/lib/vat"
import { formatPence, fullName } from "@/lib/format"
import {
  bookingConfirmationEmail,
  paymentReceiptEmail,
  pendingVaccinationEmail,
  batchPaymentReceiptEmail,
} from "@/lib/email-templates"
import { checkVaccinationGate } from "@/lib/vaccination-gate"

/**
 * Refunds one booking's Payment via Stripe, marks it REFUNDED, and records a
 * matching REFUND Payment row. Returns whether a refund actually happened.
 *
 * Two things this has to get right for a batch-paid Day Care date (see
 * createBatchCheckoutSession / markBatchPaymentSucceededAndNotify):
 *
 * 1. Only the batch's *anchor* booking's Payment row carries a real
 *    stripePaymentIntentId — every other date's row has none, since Stripe
 *    only gives one PaymentIntent for the whole batch's Checkout session.
 *    Refunding a non-anchor date has to fall back to that shared
 *    PaymentIntent (found via the other bookings sharing the same batchId)
 *    rather than silently doing nothing.
 * 2. That shared PaymentIntent was charged for the *whole batch*, not just
 *    one date — so every refund against it, anchor included, must pass an
 *    explicit `amount` for just this payment's own share. Omitting `amount`
 *    refunds the entire PaymentIntent, which would hand back money for
 *    other dates in the batch that aren't being cancelled.
 */
export async function refundPayment(
  bookingId: string,
  payment: { id: string; stripePaymentIntentId: string | null; amountPence: number },
  batchId?: string | null
): Promise<boolean> {
  if (!stripe) return false

  let paymentIntentId = payment.stripePaymentIntentId
  if (!paymentIntentId && batchId) {
    const anchor = await prisma.payment.findFirst({
      where: { stripePaymentIntentId: { not: null }, booking: { batchId } },
      select: { stripePaymentIntentId: true },
    })
    paymentIntentId = anchor?.stripePaymentIntentId ?? null
  }
  if (!paymentIntentId) return false

  try {
    await stripe.refunds.create({ payment_intent: paymentIntentId, amount: payment.amountPence })
    await prisma.$transaction([
      prisma.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } }),
      prisma.payment.create({
        data: { bookingId, type: "REFUND", amountPence: payment.amountPence, status: "SUCCEEDED" },
      }),
    ])
    return true
  } catch (error) {
    console.error(`[refundPayment] failed to refund payment ${payment.id}`, error)
    return false
  }
}

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

// Same idea as markPaymentSucceededAndNotify, but for a batch Checkout
// session covering several same-batch Day Care dates at once (see
// createBatchCheckoutSession) — only one Payment row (the "anchor",
// attached to the first booking) exists yet, holding the whole batch total
// against the real stripePaymentIntentId. This fans it back out: creates
// the rest of the bookings' own Payment rows, corrects the anchor's amount
// down to just its own booking's share, re-runs the vaccination gate and
// confirms each booking individually (exactly as the single-payment path
// does), and sends one combined receipt rather than N separate ones.
// `bookingIds` comes from the Checkout Session/PaymentIntent metadata set
// at creation — see the webhook handlers in api/webhooks/stripe/route.ts.
export async function markBatchPaymentSucceededAndNotify(
  stripePaymentIntentId: string,
  bookingIds: string[]
): Promise<void> {
  const anchor = await prisma.payment.findUnique({ where: { stripePaymentIntentId } })
  if (!anchor || anchor.status === "SUCCEEDED") return // already processed or unknown

  await prisma.payment.update({
    where: { id: anchor.id },
    data: { status: "SUCCEEDED", succeededAt: new Date() },
  })

  const bookings = await prisma.booking.findMany({
    where: { id: { in: bookingIds } },
    include: { service: true, customer: true, bookingDogs: { include: { dog: true } } },
  })
  if (bookings.length === 0) return

  const sumDeposits = bookings.reduce((sum, b) => sum + b.depositPence, 0)
  const sumTotals = bookings.reduce((sum, b) => sum + b.totalPence, 0)
  // Same detection approach as the single-booking "was this a full payment"
  // check — compare what was actually charged against what a deposit-only
  // batch would have cost, rather than threading the original DEPOSIT/FULL
  // choice through as its own piece of state.
  const wasFullPayment = anchor.amountPence > sumDeposits && sumTotals > sumDeposits
  const batchTotalPence = anchor.amountPence
  const settings = await getSettings()
  const now = new Date()

  for (const booking of bookings) {
    // The DEPOSIT-typed row is always just the deposit portion, whether or
    // not this was a full payment — a separate BALANCE row (below) covers
    // the remainder for a full payment. Getting this wrong double-counts:
    // recording the whole total here *and* the remainder in BALANCE would
    // add up to more than what was actually paid.
    const bookingAmountPence = booking.depositPence

    if (booking.id === anchor.bookingId) {
      await prisma.payment.update({ where: { id: anchor.id }, data: { amountPence: bookingAmountPence } })
    } else {
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          type: "DEPOSIT",
          amountPence: bookingAmountPence,
          status: "SUCCEEDED",
          succeededAt: now,
        },
      })
    }

    if (wasFullPayment) {
      const balancePence = booking.totalPence - booking.depositPence
      if (balancePence > 0) {
        await prisma.payment.create({
          data: {
            bookingId: booking.id,
            type: "BALANCE",
            amountPence: balancePence,
            status: "SUCCEEDED",
            succeededAt: now,
          },
        })
      }
    }

    if (booking.status === "PENDING_PAYMENT") {
      const gate = await checkVaccinationGate(
        booking.bookingDogs.map((bd) => bd.dogId),
        booking.endDate
      )
      const newStatus = gate.ok ? "CONFIRMED" : "PENDING_VACCINATION"
      await prisma.booking.update({ where: { id: booking.id }, data: { status: newStatus } })

      if (newStatus === "PENDING_VACCINATION") {
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

    await logAudit({
      actorId: booking.customer.id,
      action: "PAYMENT_SUCCEEDED",
      entity: "Booking",
      entityId: booking.id,
      meta: `${wasFullPayment ? "FULL" : "DEPOSIT"} (batch) — ${formatPence(wasFullPayment ? booking.totalPence : bookingAmountPence)} — ${describeBooking(booking)}`,
    })
  }

  const receipt = batchPaymentReceiptEmail(
    settings,
    bookings[0].service.name,
    bookings.map((b) => b.startDate).sort((a, b) => a.getTime() - b.getTime()),
    batchTotalPence,
    wasFullPayment ? "FULL" : "DEPOSIT"
  )
  await sendEmail({ to: bookings[0].customer.email, subject: receipt.subject, html: receipt.html })
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
      let batchBookingIds: string[] | null = null

      if (storedId.startsWith("cs_")) {
        // Stored id is a Checkout Session placeholder — check the session.
        const checkoutSession = await stripe.checkout.sessions.retrieve(storedId)
        paid = checkoutSession.payment_status === "paid"
        paymentIntentId =
          typeof checkoutSession.payment_intent === "string"
            ? checkoutSession.payment_intent
            : (checkoutSession.payment_intent?.id ?? null)
        if (checkoutSession.metadata?.batchBookingIds) {
          batchBookingIds = checkoutSession.metadata.batchBookingIds.split(",")
        }
      } else if (storedId.startsWith("pi_")) {
        const paymentIntent = await stripe.paymentIntents.retrieve(storedId)
        paid = paymentIntent.status === "succeeded"
        paymentIntentId = paymentIntent.id
        if (paymentIntent.metadata?.batchBookingIds) {
          batchBookingIds = paymentIntent.metadata.batchBookingIds.split(",")
        }
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
      if (!resolvedId) continue
      if (batchBookingIds) {
        await markBatchPaymentSucceededAndNotify(resolvedId, batchBookingIds)
      } else {
        await markPaymentSucceededAndNotify(resolvedId)
      }
    } catch (error) {
      console.error(`[reconcile] could not reconcile payment ${payment.id}`, error)
    }
  }
}
