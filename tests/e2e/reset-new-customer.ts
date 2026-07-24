import { PrismaNeon } from "@prisma/adapter-neon"
import { PrismaClient } from "../../src/generated/prisma/client"
import { E2E_NEW_CUSTOMER_EMAIL } from "./fixtures"

// Removes the account new-customer-with-dog.spec.ts creates, plus everything
// hanging off it, so the spec is idempotent whether the previous run
// finished, failed, or was interrupted. Run as a standalone tsx process (not
// imported into the spec file) because the generated Prisma client is
// ESM-only (uses import.meta.url) and Playwright's own TS loader can't load
// that inline the way tsx can.
async function reset() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  const existing = await prisma.user.findUnique({ where: { email: E2E_NEW_CUSTOMER_EMAIL } })
  if (existing) {
    const customerId = existing.id
    await prisma.trialVisit.deleteMany({ where: { booking: { customerId } } })
    await prisma.review.deleteMany({ where: { customerId } })
    await prisma.signedAgreement.deleteMany({ where: { customerId } })
    await prisma.subscription.deleteMany({ where: { customerId } })
    await prisma.waitlistEntry.deleteMany({ where: { customerId } })
    await prisma.creditLedger.deleteMany({ where: { customerId } })
    await prisma.notificationPreference.deleteMany({ where: { customerId } })
    await prisma.messageLog.deleteMany({ where: { customerId } })
    await prisma.booking.deleteMany({ where: { customerId } })
    await prisma.dog.deleteMany({ where: { ownerId: customerId } })
    await prisma.user.delete({ where: { id: customerId } })
  }

  await prisma.$disconnect()
}

reset().catch((error) => {
  console.error(error)
  process.exit(1)
})
