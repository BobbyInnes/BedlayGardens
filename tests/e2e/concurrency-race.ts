// Concurrency-correctness checks — not Playwright tests themselves (no
// browser involved), run as a standalone tsx process like
// verify-balance-due-date.ts and reset-new-customer.ts, and driven by
// concurrency-race.spec.ts. Fires real concurrent calls at the same
// server-side booking-creation code the app uses (resolveBookingCreation),
// bypassing the browser/HTTP layer entirely so this stays fast and doesn't
// depend on Next's internal Server Action request format.
//
// Two races, both documented as deliberately guarded against in
// book/actions.ts:
//   1. Kennel allocation (unique-constraint retry loop) — N customers with
//      LARGE dogs all requesting the same nights, where only one LARGE
//      kennel exists in the seed data. Exactly one should win; the rest
//      should fail cleanly, never double-book the same kennel/night.
//   2. Day Care capacity (SERIALIZABLE-transaction retry loop) — enough
//      concurrent single-dog bookings to exceed daycare_max_capacity for one
//      day. Exactly `remaining capacity` should succeed; the rest should
//      fail cleanly, never exceed capacity.
import { PrismaNeon } from "@prisma/adapter-neon"
import bcrypt from "bcryptjs"
import { PrismaClient } from "../../src/generated/prisma/client"
import { resolveBookingCreation } from "../../src/app/(marketing)/book/actions"
import { deleteCustomerAndAllData } from "../../src/lib/delete-customer"
// toDateInputValue formats in local time, matching what the booking wizard
// sends — a UTC-based toISOString().slice(0, 10) reads a day early/late
// whenever local time isn't UTC, which silently pointed every query in this
// file at the wrong day the first time this was written.
import { toDateInputValue } from "../../src/lib/dates"

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

function daysFromNow(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(0, 0, 0, 0)
  return d
}

function nextWeekdayFromNow(n: number): Date {
  const d = daysFromNow(n)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  return d
}

let meetGreetServiceId: string | null = null

// Both daycare and overnight-boarding require a PASSED trial (Meet & Greet)
// on file before a dog's first booking — give every throwaway dog one so
// the race tests actually exercise kennel/capacity logic, not this gate.
async function givePassedTrial(customerId: string, dogId: string) {
  if (!meetGreetServiceId) {
    const service = await prisma.service.findUnique({ where: { slug: "meet-greet" } })
    if (!service) throw new Error("No 'meet-greet' service in the test database")
    meetGreetServiceId = service.id
  }
  const past = new Date()
  past.setDate(past.getDate() - 7)
  const booking = await prisma.booking.create({
    data: {
      customerId,
      serviceId: meetGreetServiceId,
      startDate: past,
      endDate: past,
      status: "COMPLETED",
      totalPence: 0,
      depositPence: 0,
      bookingDogs: { create: { dogId } },
    },
  })
  await prisma.trialVisit.create({
    data: { dogId, bookingId: booking.id, outcome: "PASSED", completedAt: new Date() },
  })
}

async function makeThrowawayCustomer(tag: string, index: number) {
  const passwordHash = await bcrypt.hash("RaceTestPass123!", 10)
  const customer = await prisma.user.create({
    data: {
      forename: "Race",
      surname: `${tag}${index}`,
      email: `e2e.race.${tag}.${index}.${Date.now()}@example.test`,
      passwordHash,
      role: "CUSTOMER",
      emailVerified: new Date(),
    },
  })
  const activeAgreement = await prisma.agreement.findFirst({
    where: { active: true },
    orderBy: { publishedAt: "desc" },
  })
  if (activeAgreement) {
    await prisma.signedAgreement.create({
      data: {
        agreementId: activeAgreement.id,
        customerId: customer.id,
        signedName: `Race ${tag}${index}`,
        ipAddress: "127.0.0.1",
      },
    })
  }
  return customer
}

async function kennelRace() {
  const N = 2 // matches the single LARGE kennel unit in the seed data
  const customers = await Promise.all(
    Array.from({ length: N }, (_, i) => makeThrowawayCustomer("kennel", i))
  )
  const dogs = await Promise.all(
    customers.map((c) =>
      prisma.dog.create({ data: { ownerId: c.id, name: `Race Dog ${c.id.slice(-4)}`, breed: "Mastiff", size: "LARGE" } })
    )
  )
  await Promise.all(dogs.map((d, i) => givePassedTrial(customers[i].id, d.id)))

  // Clear of the seed's existing Large-kennel occupancy windows
  // (checked-in stay -1..+2 days, "fully booked next month" +30..+35).
  const startDate = daysFromNow(10)
  const endDate = daysFromNow(12)

  const results = await Promise.all(
    customers.map((c, i) =>
      resolveBookingCreation(
        c.id,
        {
          serviceSlug: "overnight-boarding",
          dogIds: [dogs[i].id],
          addons: [],
          startDate: toDateInputValue(startDate),
          endDate: toDateInputValue(endDate),
        },
        { skipVaccinationGate: true }
      )
    )
  )

  const succeeded = results.filter((r) => r.status !== "error")
  const failed = results.filter((r) => r.status === "error")

  const occupancies = await prisma.kennelOccupancy.findMany({
    where: { date: { gte: startDate, lt: endDate } },
  })
  const nightKey = (o: { kennelUnitId: string; date: Date }) => `${o.kennelUnitId}|${o.date.toISOString()}`
  const seen = new Set<string>()
  let doubleBooked = 0
  for (const o of occupancies) {
    const key = nightKey(o)
    if (seen.has(key)) doubleBooked++
    seen.add(key)
  }

  // Cleanup — bookings first (deleteCustomerAndAllData handles the rest per customer).
  for (const c of customers) {
    await deleteCustomerAndAllData(prisma, c.id).catch(() => {})
  }

  return {
    attempted: N,
    succeeded: succeeded.length,
    failed: failed.length,
    failureMessages: failed.map((r) => r.message),
    distinctKennelNightsBooked: seen.size,
    doubleBookedNights: doubleBooked,
  }
}

async function daycareRace() {
  const service = await prisma.service.findUnique({ where: { slug: "daycare" } })
  if (!service) throw new Error("No 'daycare' service in the test database")

  // Firing dozens of fully-concurrent SERIALIZABLE transactions exhausts the
  // Neon pooled-connection limit in a hurry (P2028 "unable to start a
  // transaction"), which tests connection-pool capacity, not the business
  // logic. Temporarily shrink the capacity setting instead, so a small,
  // pool-friendly number of concurrent requests is still enough to exceed
  // it — restored in the `finally` below no matter what happens.
  const TEST_CAPACITY = "3"
  const originalSetting = await prisma.setting.findUnique({ where: { key: "daycare_max_capacity" } })
  const originalValue = originalSetting?.value ?? null

  const date = nextWeekdayFromNow(20)
  const existingCount = await prisma.bookingDog.count({
    where: {
      booking: {
        startDate: date,
        service: { slug: "daycare" },
        status: { notIn: ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_ADMIN", "NO_SHOW"] },
      },
    },
  })
  const capacity = Number(TEST_CAPACITY)
  const remaining = Math.max(0, capacity - existingCount)
  // A few more attempts than remaining capacity, so some must fail — kept
  // small enough to stay within the test DB's pooled-connection limit.
  const N = remaining + 3

  await prisma.setting.upsert({
    where: { key: "daycare_max_capacity" },
    update: { value: TEST_CAPACITY },
    create: { key: "daycare_max_capacity", value: TEST_CAPACITY },
  })

  let customers: Awaited<ReturnType<typeof makeThrowawayCustomer>>[] = []
  try {
    customers = await Promise.all(Array.from({ length: N }, (_, i) => makeThrowawayCustomer("daycare", i)))
    const dogs = await Promise.all(
      customers.map((c) => prisma.dog.create({ data: { ownerId: c.id, name: `Race Dog ${c.id.slice(-4)}`, breed: "Beagle" } }))
    )
    await Promise.all(dogs.map((d, i) => givePassedTrial(customers[i].id, d.id)))

    // allSettled, not all — in real traffic one request throwing (e.g. an
    // uncaught serialization error) doesn't cancel every other concurrent
    // request, so the test shouldn't let it wipe out every other result either.
    const settled = await Promise.allSettled(
      customers.map((c, i) =>
        resolveBookingCreation(
          c.id,
          {
            serviceSlug: "daycare",
            dogIds: [dogs[i].id],
            addons: [],
            date: toDateInputValue(date),
            daycareDuration: "FULL_DAY",
          },
          { skipVaccinationGate: true }
        )
      )
    )

    const succeeded = settled.filter((r) => r.status === "fulfilled" && r.value.status !== "error")
    const failed = settled.filter((r) => r.status === "fulfilled" && r.value.status === "error")
    const threw = settled.filter((r) => r.status === "rejected")

    const finalCount = await prisma.bookingDog.count({
      where: {
        booking: {
          startDate: date,
          service: { slug: "daycare" },
          status: { notIn: ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_ADMIN", "NO_SHOW"] },
        },
      },
    })

    return {
      capacity,
      existingCount,
      remaining,
      attempted: N,
      succeeded: succeeded.length,
      failed: failed.length,
      failureMessages: failed.map((r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof resolveBookingCreation>>>).value.message),
      threw: threw.length,
      threwErrors: threw.map((r) => String((r as PromiseRejectedResult).reason)),
      countAfterRace: finalCount,
      overBooked: finalCount - existingCount > remaining,
    }
  } finally {
    for (const c of customers) {
      await deleteCustomerAndAllData(prisma, c.id).catch(() => {})
    }
    // Restore the real capacity setting no matter what happened above.
    if (originalValue === null) {
      await prisma.setting.delete({ where: { key: "daycare_max_capacity" } }).catch(() => {})
    } else {
      await prisma.setting.update({ where: { key: "daycare_max_capacity" }, data: { value: originalValue } })
    }
  }
}

async function main() {
  const [kennel, daycare] = [await kennelRace(), await daycareRace()]
  console.log(JSON.stringify({ kennelRace: kennel, daycareRace: daycare }))
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
