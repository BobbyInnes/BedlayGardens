import { PrismaNeon } from "@prisma/adapter-neon"
import { PrismaClient } from "../../src/generated/prisma/client"

// Reports a booking's status and its most recent payment's status, as JSON on
// stdout. Run as a standalone tsx process (not imported into the spec) for
// the same ESM reason as reset-new-customer.ts: the generated Prisma client
// is ESM-only and Playwright's TS loader can't load it inline the way tsx
// can. Takes the booking id as its one argument.
async function main() {
  const bookingId = process.argv[2]
  if (!bookingId) throw new Error("Usage: verify-payment-succeeded.ts <bookingId>")

  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  })

  await prisma.$disconnect()
  process.stdout.write(
    JSON.stringify({ status: booking.status, paymentStatus: booking.payments[0]?.status ?? null })
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
