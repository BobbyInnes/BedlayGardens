"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe, getSiteUrl } from "@/lib/stripe"
import { pauseSubscription as pauseSubscriptionLib } from "@/lib/subscriptions"

export type SubscriptionActionState = { status: "idle" | "error"; message?: string }

const SUBSCRIBABLE_SLUGS = ["daycare", "dog-walking"]

const createSchema = z.object({
  serviceSlug: z.enum(["daycare", "dog-walking"]),
  dogId: z.string().min(1),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, "Choose at least one day"),
  slot: z.string().trim().min(1, "Choose a time"),
})

async function ensureStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  if (user.stripeCustomerId) return user.stripeCustomerId
  const customer = await stripe!.customers.create({ email: user.email, name: user.name, metadata: { userId } })
  await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } })
  return customer.id
}

export async function createSubscription(input: {
  serviceSlug: string
  dogId: string
  weekdays: number[]
  slot: string
}): Promise<SubscriptionActionState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Please log in." }
  if (!SUBSCRIBABLE_SLUGS.includes(input.serviceSlug)) {
    return { status: "error", message: "This service isn't available as a subscription." }
  }

  const parsed = createSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const dog = await prisma.dog.findUnique({ where: { id: parsed.data.dogId } })
  if (!dog || dog.ownerId !== session.user.id) {
    return { status: "error", message: "Dog not found." }
  }

  const service = await prisma.service.findUnique({ where: { slug: parsed.data.serviceSlug } })
  if (!service) return { status: "error", message: "Service not found." }

  const weeklyPricePence = service.basePricePence * parsed.data.weekdays.length

  const subscription = await prisma.subscription.create({
    data: {
      customerId: session.user.id,
      serviceId: service.id,
      dogId: dog.id,
      weekdays: parsed.data.weekdays.join(","),
      slot: parsed.data.slot,
      status: stripe ? "PENDING" : "ACTIVE",
    },
  })

  if (!stripe) {
    revalidatePath("/portal/subscriptions")
    return { status: "idle", message: "Subscription created — online payment isn't enabled yet, so we'll invoice you directly." }
  }

  const customerId = await ensureStripeCustomer(session.user.id)
  const baseUrl = getSiteUrl()
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: weeklyPricePence,
          recurring: { interval: "week" },
          product_data: { name: `${service.name} subscription — ${dog.name}` },
        },
      },
    ],
    metadata: { subscriptionId: subscription.id },
    subscription_data: { metadata: { subscriptionId: subscription.id } },
    success_url: `${baseUrl}/portal/subscriptions?checkout=success`,
    cancel_url: `${baseUrl}/portal/subscriptions?checkout=cancelled`,
  })

  if (!checkoutSession.url) {
    return { status: "error", message: "Could not start checkout. Please try again." }
  }
  redirect(checkoutSession.url)
}

export async function pauseSubscription(subscriptionId: string, pausedUntil: string): Promise<SubscriptionActionState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Please log in." }

  const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } })
  if (!subscription || subscription.customerId !== session.user.id) {
    return { status: "error", message: "Subscription not found." }
  }

  const result = await pauseSubscriptionLib(subscriptionId, new Date(pausedUntil))
  if (!result.ok) return { status: "error", message: result.message }

  revalidatePath("/portal/subscriptions")
  return { status: "idle", message: "Paused." }
}

export async function resumeSubscription(subscriptionId: string): Promise<SubscriptionActionState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Please log in." }

  const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } })
  if (!subscription || subscription.customerId !== session.user.id) {
    return { status: "error", message: "Subscription not found." }
  }

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: "ACTIVE", pausedUntil: null },
  })
  revalidatePath("/portal/subscriptions")
  return { status: "idle", message: "Resumed." }
}

export async function cancelSubscription(subscriptionId: string): Promise<SubscriptionActionState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Please log in." }

  const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } })
  if (!subscription || subscription.customerId !== session.user.id) {
    return { status: "error", message: "Subscription not found." }
  }

  if (stripe && subscription.stripeSubscriptionId) {
    await stripe.subscriptions.cancel(subscription.stripeSubscriptionId).catch(() => {})
  }

  await prisma.subscription.update({ where: { id: subscriptionId }, data: { status: "CANCELLED" } })
  revalidatePath("/portal/subscriptions")
  return { status: "idle", message: "Cancelled." }
}
