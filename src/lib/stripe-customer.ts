import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

export async function ensureStripeCustomer(userId: string): Promise<string> {
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

  let customer
  try {
    customer = await stripe!.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: user.id },
    })
  } catch (error) {
    console.error("[stripe] customers.create failed", error)
    throw error
  }
  await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } })
  return customer.id
}
