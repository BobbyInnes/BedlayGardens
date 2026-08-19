"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe, getSiteUrl } from "@/lib/stripe"
import { pauseSubscription as pauseSubscriptionLib, parseWeekdays } from "@/lib/subscriptions"

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
  const customer = await stripe!.customers.create({
    email: user.email,
    name: user.name,
    address: { country: "GB" },
    metadata: { userId },
  })
  await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } })
  return customer.id
}

async function startSubscriptionCheckout(
  customerUserId: string,
  subscriptionId: string,
  service: { name: string; basePricePence: number },
  dog: { name: string },
  weekdayCount: number
): Promise<SubscriptionActionState> {
  const weeklyPricePence = service.basePricePence * weekdayCount
  const customerId = await ensureStripeCustomer(customerUserId)
  const baseUrl = getSiteUrl()
  const checkoutSession = await stripe!.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    // GBP only — see payment-actions.ts for why Adaptive Pricing is off.
    adaptive_pricing: { enabled: false },
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
    metadata: { subscriptionId },
    subscription_data: { metadata: { subscriptionId } },
    success_url: `${baseUrl}/portal/subscriptions?checkout=success`,
    cancel_url: `${baseUrl}/portal/subscriptions?checkout=cancelled`,
  })

  if (!checkoutSession.url) {
    return { status: "error", message: "Could not start checkout. Please try again." }
  }
  redirect(checkoutSession.url)
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

  return startSubscriptionCheckout(session.user.id, subscription.id, service, dog, parsed.data.weekdays.length)
}

/**
 * For a subscription stuck at PENDING (Stripe Checkout was abandoned before
 * payment setup completed, or its confirming webhook never arrived) —
 * starts a fresh Checkout session against the same subscription row rather
 * than creating a duplicate. There was previously no way to recover from
 * this state short of contacting support.
 */
export async function retrySubscriptionCheckout(subscriptionId: string): Promise<SubscriptionActionState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Please log in." }
  if (!stripe) return { status: "error", message: "Online payment isn't enabled." }

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { service: true, dog: true },
  })
  if (!subscription || subscription.customerId !== session.user.id) {
    return { status: "error", message: "Subscription not found." }
  }
  if (subscription.status !== "PENDING") {
    return { status: "error", message: "This subscription doesn't need payment setup." }
  }

  return startSubscriptionCheckout(
    session.user.id,
    subscription.id,
    subscription.service,
    subscription.dog,
    parseWeekdays(subscription.weekdays).length
  )
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
