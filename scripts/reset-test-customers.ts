// One-off admin utility: wipes every CUSTOMER-role account, their dogs and
// bookings (and everything hanging off those), plus the entire audit log —
// on the TEST database only. Admin/staff accounts and reference data
// (Services, Settings, Referral Sources, Agreements, etc.) are left alone.
//
// Run with: npx tsx --env-file=.env.test scripts/reset-test-customers.ts
//
// Refuses to run unless DATABASE_URL resolves to the known Neon test branch
// host — see memory/test-db-and-e2e.md. There is no undo.
import { PrismaNeon } from "@prisma/adapter-neon"
import { PrismaClient } from "../src/generated/prisma/client"

const TEST_DB_HOST = "ep-falling-water-abdgailo-pooler.eu-west-2.aws.neon.tech"

async function main() {
  const url = process.env.DATABASE_URL ?? ""
  if (!url.includes(TEST_DB_HOST)) {
    console.error(
      `Refusing to run: DATABASE_URL doesn't look like the test branch (expected host "${TEST_DB_HOST}"). ` +
        `Run this with "npx tsx --env-file=.env.test ...".`
    )
    process.exit(1)
  }

  const adapter = new PrismaNeon({ connectionString: url })
  const prisma = new PrismaClient({ adapter })

  const customers = await prisma.user.findMany({ where: { role: "CUSTOMER" }, select: { id: true } })
  const customerIds = customers.map((c) => c.id)
  const [dogCount, bookingCount, auditLogCount] = await Promise.all([
    prisma.dog.count({ where: { ownerId: { in: customerIds } } }),
    prisma.booking.count({ where: { customerId: { in: customerIds } } }),
    prisma.auditLog.count(),
  ])

  console.log(`Target DB host: ${TEST_DB_HOST}`)
  console.log(
    `About to delete ${customerIds.length} customer(s), ${dogCount} dog(s), ${bookingCount} booking(s), and all ${auditLogCount} audit log row(s).`
  )

  if (customerIds.length === 0 && auditLogCount === 0) {
    console.log("Nothing to do.")
    return
  }

  await prisma.$transaction([
    // Everything with a non-cascading FK to a customer, their dogs, or their
    // bookings has to go before the booking/dog/user rows themselves.
    prisma.auditLog.deleteMany({}),
    prisma.walkBooking.deleteMany({ where: { dog: { ownerId: { in: customerIds } } } }),
    prisma.vanRunStop.deleteMany({ where: { dog: { ownerId: { in: customerIds } } } }),
    prisma.trialVisit.deleteMany({ where: { dog: { ownerId: { in: customerIds } } } }),
    prisma.review.deleteMany({ where: { customerId: { in: customerIds } } }),
    prisma.subscription.deleteMany({ where: { customerId: { in: customerIds } } }),
    prisma.waitlistEntry.deleteMany({ where: { customerId: { in: customerIds } } }),
    prisma.creditLedger.deleteMany({ where: { customerId: { in: customerIds } } }),
    prisma.signedAgreement.deleteMany({ where: { customerId: { in: customerIds } } }),
    prisma.notificationPreference.deleteMany({ where: { customerId: { in: customerIds } } }),
    prisma.messageLog.deleteMany({ where: { customerId: { in: customerIds } } }),
    prisma.contactMessage.deleteMany({ where: { userId: { in: customerIds } } }),
    // Detach rather than delete — a voucher code/balance isn't "customer
    // data" the way the rest of this list is.
    prisma.voucher.updateMany({ where: { purchaserId: { in: customerIds } }, data: { purchaserId: null } }),
    // Cascades clear BookingDog, BookingAddon, Payment, KennelOccupancy,
    // CareTask, IncidentReport, Pupdate, BookingBelongingPhoto.
    prisma.booking.deleteMany({ where: { customerId: { in: customerIds } } }),
    // Cascades clear VaccinationRecord, DogMedication, DogFeedingItem,
    // DogFlag, DogTagAssignment.
    prisma.dog.deleteMany({ where: { ownerId: { in: customerIds } } }),
    // Cascades clear Account, Session, PasswordResetToken, CustomerTagAssignment.
    prisma.user.deleteMany({ where: { role: "CUSTOMER" } }),
  ])

  console.log("Done.")
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => process.exit(0))
