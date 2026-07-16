import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

export async function ensureStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  if (user.stripeCustomerId) return user.stripeCustomerId

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
