import { PrismaNeon } from "@prisma/adapter-neon"
import { PrismaClient } from "../../src/generated/prisma/client"
import { deleteCustomerAndAllData } from "../../src/lib/delete-customer"
import { SCREENSHOT_CUSTOMER_EMAIL, SCREENSHOT_ADMIN_NEW_CUSTOMER_EMAIL } from "./fixtures"

// Removes both dedicated screenshot accounts (and everything hanging off
// them), so customer-journey.spec.ts and admin-create-customer.spec.ts are
// idempotent whether the previous run finished, failed, or was interrupted.
// Run as a standalone tsx process — see tests/e2e/reset-new-customer.ts for
// why this can't be imported directly into a spec file (the generated
// Prisma client is ESM-only; Playwright's own TS loader can't load that
// inline the way tsx can).
async function reset() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  for (const email of [SCREENSHOT_CUSTOMER_EMAIL, SCREENSHOT_ADMIN_NEW_CUSTOMER_EMAIL]) {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      await deleteCustomerAndAllData(prisma, existing.id)
    }
  }

  await prisma.$disconnect()
}

reset().catch((error) => {
  console.error(error)
  process.exit(1)
})
