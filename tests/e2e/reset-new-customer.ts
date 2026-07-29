import { PrismaNeon } from "@prisma/adapter-neon"
import { PrismaClient } from "../../src/generated/prisma/client"
import { deleteCustomerAndAllData } from "../../src/lib/delete-customer"
import { E2E_NEW_CUSTOMER_EMAIL } from "./fixtures"

// Removes the account new-customer-with-dog.spec.ts creates, plus everything
// hanging off it, so the spec is idempotent whether the previous run
// finished, failed, or was interrupted. Run as a standalone tsx process (not
// imported into the spec file) because the generated Prisma client is
// ESM-only (uses import.meta.url) and Playwright's own TS loader can't load
// that inline the way tsx can.
//
// Reuses the same cascade the admin "delete customer" action uses, rather
// than a hand-duplicated list of deleteMany calls — this account triggers
// audit-logged actions (registration, dog creation) same as a real customer,
// so it needs the exact same cleanup (including AuditLog rows) or deletion
// fails on a foreign-key violation.
async function reset() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  const existing = await prisma.user.findUnique({ where: { email: E2E_NEW_CUSTOMER_EMAIL } })
  if (existing) {
    await deleteCustomerAndAllData(prisma, existing.id)
  }

  await prisma.$disconnect()
}

reset().catch((error) => {
  console.error(error)
  process.exit(1)
})
