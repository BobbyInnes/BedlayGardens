import { PrismaNeon } from "@prisma/adapter-neon"
import bcrypt from "bcryptjs"
import fs from "node:fs"
import { PrismaClient } from "../../src/generated/prisma/client"
import {
  E2E_CUSTOMER_EMAIL,
  E2E_CUSTOMER_PASSWORD,
  E2E_DOG_NAME,
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  E2E_STAFF_EMAIL,
  E2E_STAFF_PASSWORD,
  SEED_IDS_PATH,
  type SeedIds,
} from "./fixtures"

type Db = PrismaClient

// Remove a test user and everything hanging off it, so the seed is idempotent.
async function resetUser(prisma: Db, email: string) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (!existing) return
  await prisma.booking.deleteMany({ where: { customerId: existing.id } })
  await prisma.dog.deleteMany({ where: { ownerId: existing.id } })
  await prisma.user.delete({ where: { id: existing.id } })
}

async function seed() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  for (const email of [E2E_CUSTOMER_EMAIL, E2E_ADMIN_EMAIL, E2E_STAFF_EMAIL]) {
    await resetUser(prisma, email)
  }

  const [customerHash, adminHash, staffHash] = await Promise.all([
    bcrypt.hash(E2E_CUSTOMER_PASSWORD, 10),
    bcrypt.hash(E2E_ADMIN_PASSWORD, 10),
    bcrypt.hash(E2E_STAFF_PASSWORD, 10),
  ])

  const customer = await prisma.user.create({
    data: {
      name: "E2E Customer",
      email: E2E_CUSTOMER_EMAIL,
      passwordHash: customerHash,
      role: "CUSTOMER",
      emailVerified: new Date(),
    },
  })
  const admin = await prisma.user.create({
    data: {
      name: "E2E Admin",
      email: E2E_ADMIN_EMAIL,
      passwordHash: adminHash,
      role: "ADMIN",
      emailVerified: new Date(),
    },
  })
  const staff = await prisma.user.create({
    data: {
      name: "E2E Staff",
      email: E2E_STAFF_EMAIL,
      passwordHash: staffHash,
      role: "STAFF",
      emailVerified: new Date(),
      jobTitle: "Carer",
      active: true,
    },
  })

  const dog = await prisma.dog.create({
    data: { ownerId: customer.id, name: E2E_DOG_NAME, breed: "Labrador" },
  })

  const farFutureExpiry = new Date()
  farFutureExpiry.setFullYear(farFutureExpiry.getFullYear() + 1)
  for (const type of ["DHPP", "Leptospirosis", "Kennel Cough"]) {
    await prisma.vaccinationRecord.create({
      data: {
        dogId: dog.id,
        type,
        dateGiven: new Date(),
        expiryDate: farFutureExpiry,
        status: "VERIFIED",
      },
    })
  }

  // A service to hang the bookings off — prefer daycare (from the main seed).
  const service =
    (await prisma.service.findUnique({ where: { slug: "daycare" } })) ??
    (await prisma.service.findFirst())
  if (!service) {
    throw new Error(
      "No services in the test database — run the main seed first: tsx --env-file=.env.test prisma/seed.ts"
    )
  }

  function futureRange(daysAhead: number) {
    const start = new Date()
    start.setDate(start.getDate() + daysAhead)
    start.setHours(9, 0, 0, 0)
    const end = new Date(start)
    end.setHours(17, 0, 0, 0)
    return { start, end }
  }

  const confirmed = futureRange(30)
  const booking = await prisma.booking.create({
    data: {
      customerId: customer.id,
      serviceId: service.id,
      startDate: confirmed.start,
      endDate: confirmed.end,
      status: "CONFIRMED",
      totalPence: 2600,
      depositPence: 0,
      bookingDogs: { create: { dogId: dog.id } },
    },
  })

  // A second, already checked-in booking so the staff check-out page has a valid target.
  const checkedIn = futureRange(1)
  const checkedInBooking = await prisma.booking.create({
    data: {
      customerId: customer.id,
      serviceId: service.id,
      startDate: checkedIn.start,
      endDate: checkedIn.end,
      status: "CHECKED_IN",
      totalPence: 2600,
      depositPence: 0,
      bookingDogs: { create: { dogId: dog.id } },
    },
  })

  const [kennelUnit, media, vanRun] = await Promise.all([
    prisma.kennelUnit.findFirst(),
    prisma.mediaItem.findFirst(),
    prisma.vanRun.findFirst(),
  ])

  const ids: SeedIds = {
    customerId: customer.id,
    dogId: dog.id,
    bookingId: booking.id,
    checkedInBookingId: checkedInBooking.id,
    staffId: staff.id,
    serviceId: service.id,
    serviceSlug: service.slug,
    kennelUnitId: kennelUnit?.id ?? null,
    mediaId: media?.id ?? null,
    vanRunId: vanRun?.id ?? null,
  }
  fs.writeFileSync(SEED_IDS_PATH, JSON.stringify(ids, null, 2))

  console.log(
    `[e2e seed] created test users (customer/admin/staff), 2 bookings; ids -> ${SEED_IDS_PATH}`
  )
  await prisma.$disconnect()
}

seed().catch((error) => {
  console.error(error)
  process.exit(1)
})
