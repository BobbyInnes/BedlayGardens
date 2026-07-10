import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

async function chargeBookingBalance(booking: {
  id: string
  totalPence: number
  depositPence: number
  customer: { id: string; stripeCustomerId: string | null }
}) {
  const balancePence = booking.totalPence - booking.depositPence
  if (balancePence <= 0 || !booking.customer.stripeCustomerId) {
    return { bookingId: booking.id, outcome: "skipped" as const }
  }

  const paymentMethods = await stripe!.paymentMethods.list({
    customer: booking.customer.stripeCustomerId,
    type: "card",
  })
  const paymentMethod = paymentMethods.data[0]
  if (!paymentMethod) {
    return { bookingId: booking.id, outcome: "no_payment_method" as const }
  }

  try {
    const intent = await stripe!.paymentIntents.create({
      amount: balancePence,
      currency: "gbp",
      customer: booking.customer.stripeCustomerId,
      payment_method: paymentMethod.id,
      off_session: true,
      confirm: true,
      metadata: { bookingId: booking.id, type: "BALANCE" },
    })

    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        stripePaymentIntentId: intent.id,
        type: "BALANCE",
        amountPence: balancePence,
        status: intent.status === "succeeded" ? "SUCCEEDED" : "PENDING",
      },
    })
    return { bookingId: booking.id, outcome: "charged" as const }
  } catch (error) {
    console.error(`[charge-balances] failed to charge booking ${booking.id}`, error)
    return { bookingId: booking.id, outcome: "failed" as const }
  }
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 400 })
  }
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 400 })
  }

  const dueBookings = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      balanceDueDate: { lte: new Date() },
      payments: { none: { type: "BALANCE", status: "SUCCEEDED" } },
    },
    include: { customer: { select: { id: true, stripeCustomerId: true } } },
  })

  const results = []
  for (const booking of dueBookings) {
    results.push(await chargeBookingBalance(booking))
  }

  return NextResponse.json({ processed: results.length, results })
}
