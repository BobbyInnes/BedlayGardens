"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe, getSiteUrl } from "@/lib/stripe"
import { generateVoucherCode } from "@/lib/vouchers"
import { getSettings } from "@/lib/settings"
import { sendEmail } from "@/lib/email"
import { voucherDeliveryEmail } from "@/lib/email-templates"

export type VoucherActionState = { status: "idle" | "error"; message?: string }

const purchaseSchema = z.object({
  amountPence: z.coerce.number().int().min(500, "Minimum voucher amount is £5").max(100000, "Maximum voucher amount is £1000"),
  recipientEmail: z.string().trim().email().optional().or(z.literal("")),
})

async function ensureStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  if (user.stripeCustomerId) {
    try {
      await stripe!.customers.retrieve(user.stripeCustomerId)
      return user.stripeCustomerId
    } catch {
      // Stored ID doesn't exist under the current API key (e.g. a test-mode
      // customer left over from before switching to live keys) — fall
      // through and create a fresh one.
    }
  }
  const customer = await stripe!.customers.create({ email: user.email, name: user.name, metadata: { userId } })
  await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } })
  return customer.id
}

export async function purchaseVoucher(input: {
  amountPence: number
  recipientEmail?: string
}): Promise<VoucherActionState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Please log in." }

  const parsed = purchaseSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const voucher = await prisma.voucher.create({
    data: {
      code: generateVoucherCode(),
      amountPence: parsed.data.amountPence,
      remainingPence: parsed.data.amountPence,
      purchaserId: session.user.id,
      recipientEmail: parsed.data.recipientEmail || null,
      status: stripe ? "PENDING" : "ACTIVE",
    },
  })

  if (!stripe) {
    const settings = await getSettings()
    const purchaser = await prisma.user.findUnique({ where: { id: session.user.id } })
    const recipientEmail = voucher.recipientEmail || purchaser?.email
    if (recipientEmail) {
      const email = voucherDeliveryEmail(settings, voucher.code, voucher.amountPence, purchaser?.name ?? "A friend")
      await sendEmail({ to: recipientEmail, subject: email.subject, html: email.html })
    }
    revalidatePath("/portal/vouchers")
    return {
      status: "idle",
      message: "Voucher created — online payment isn't enabled yet, so we'll invoice you directly.",
    }
  }

  const customerId = await ensureStripeCustomer(session.user.id)
  const baseUrl = getSiteUrl()
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: parsed.data.amountPence,
          product_data: { name: "Gift voucher" },
        },
      },
    ],
    metadata: { voucherId: voucher.id },
    success_url: `${baseUrl}/portal/vouchers?checkout=success`,
    cancel_url: `${baseUrl}/portal/vouchers?checkout=cancelled`,
  })

  if (!checkoutSession.url) {
    return { status: "error", message: "Could not start checkout. Please try again." }
  }
  redirect(checkoutSession.url)
}
