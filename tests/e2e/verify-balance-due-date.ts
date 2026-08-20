import { PrismaNeon } from "@prisma/adapter-neon"
import { PrismaClient } from "../../src/generated/prisma/client"
import { E2E_CUSTOMER_EMAIL } from "./fixtures"

// Reports balanceDueDate on the customer's most-recently-created daycare
// bookings, as JSON on stdout. Run as a standalone tsx process (not imported
// into the spec) for the same ESM reason as reset-new-customer.ts: the
// generated Prisma client is ESM-only and Playwright's TS loader can't load
// it inline the way tsx can.
async function main() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  const customer = await prisma.user.findUniqueOrThrow({ where: { email: E2E_CUSTOMER_EMAIL } })
  const bookings = await prisma.booking.findMany({
    where: { customerId: customer.id, service: { slug: "daycare" } },
    orderBy: { createdAt: "desc" },
    take: 2,
    select: { id: true, balanceDueDate: true },
  })

  await prisma.$disconnect()
  process.stdout.write(JSON.stringify(bookings))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
