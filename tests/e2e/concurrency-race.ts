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

// Every calendar-day Date elsewhere in this app is a UTC-midnight instant
// (see the note atop lib/dates.ts) — built and read via local Date methods
// instead, this used to work when the local timezone happened to equal UTC
// but silently produced a Date one UTC day early on any machine ahead of UTC
// (e.g. BST): toDateInputValue() below reads UTC components, so the string
// handed to resolveBookingCreation() named the wrong day, and the server's
// own UTC-based weekend check (isWeekend() in lib/dates.ts) then rejected an
// intended weekday as a Saturday/Sunday.
function daysFromNow(n: number): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + n)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function nextWeekdayFromNow(n: number): Date {
  const d = daysFromNow(n)
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1)
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
  const N = 2

  // The seed used to create exactly one LARGE kennel unit, which is what
  // this race actually needs contention over — it now creates ten (see
  // prisma/seed.ts), so with N=2 both would simply succeed on two different
  // kennels and never exercise the race at all. Temporarily deactivate every
  // LARGE kennel but one — same "shrink capacity, then restore in `finally`"
  // approach daycareRace() below takes with daycare_max_capacity — so
  // exactly one is actually contended for, restored no matter what happens.
  const largeKennels = await prisma.kennelUnit.findMany({ where: { size: "LARGE", active: true } })
  if (largeKennels.length === 0) throw new Error("No active LARGE kennel units in the test database")
  const toDeactivate = largeKennels.slice(1) // keep the first one active
  if (toDeactivate.length > 0) {
    await prisma.kennelUnit.updateMany({
      where: { id: { in: toDeactivate.map((k) => k.id) } },
      data: { active: false },
    })
  }

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

  try {
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

    return {
      attempted: N,
      succeeded: succeeded.length,
      failed: failed.length,
      failureMessages: failed.map((r) => r.message),
      distinctKennelNightsBooked: seen.size,
      doubleBookedNights: doubleBooked,
    }
  } finally {
    // Cleanup — bookings first (deleteCustomerAndAllData handles the rest per customer).
    for (const c of customers) {
      await deleteCustomerAndAllData(prisma, c.id).catch(() => {})
    }
    if (toDeactivate.length > 0) {
      await prisma.kennelUnit.updateMany({
        where: { id: { in: toDeactivate.map((k) => k.id) } },
        data: { active: true },
      })
    }
  }
}

async function daycareRace() {
  // "daycare" was the old, pre-split service slug — Day Care is now two
  // services, "dayfull" and "dayhalf" (see lib/service-slugs.ts), sharing
  // one capacity pool (the "daycare_max_capacity" Setting below, which was
  // NOT renamed). "dayfull" stands in as the representative one here.
  const service = await prisma.service.findUnique({ where: { slug: "dayfull" } })
  if (!service) throw new Error("No 'dayfull' service in the test database")

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
        service: { slug: "dayfull" },
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
    customers = await Promise.all(Array.from({ length: N }, (_, i) => makeThrowawayCustomer("dayfull", i)))
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
            // daycareDuration is no longer read — duration is implied by
            // which of dayfull/dayhalf is booked (see book/actions.ts).
            serviceSlug: "dayfull",
            dogIds: [dogs[i].id],
            addons: [],
            date: toDateInputValue(date),
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
          service: { slug: "dayfull" },
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
