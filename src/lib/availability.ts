import { prisma } from "@/lib/prisma"
import type { DogSize } from "@/generated/prisma/client"
import { addDays, isWeekend, nightsBetween, startOfDay, toDateInputValue } from "@/lib/dates"
import { DOG_SIZE_ORDER } from "@/lib/dog-size-colors"
import { kennelSizeRank } from "@/lib/kennel-size"

async function isSiteWideBlocked(dates: Date[]): Promise<boolean> {
  const count = await prisma.blockedDate.count({
    where: { kennelUnitId: null, date: { in: dates } },
  })
  return count > 0
}

/**
 * Returns the first active kennel unit big enough for `dogCount` — and, when
 * `requiredSize` is given, rated at least that size (a LARGE dog can't go in
 * a SMALL kennel just because it fits one dog) — that is free for every
 * night of the stay (not blocked, no existing occupancy). Does not reserve
 * anything — call this for a preview; booking creation re-checks and
 * reserves atomically inside a transaction.
 */
export async function findAvailableKennelUnit(
  startDate: Date,
  endDate: Date,
  dogCount: number,
  requiredSize: DogSize | null = null
) {
  const nights = nightsBetween(startDate, endDate)
  if (nights.length === 0) return null
  if (await isSiteWideBlocked(nights)) return null

  const units = await prisma.kennelUnit.findMany({
    where: { active: true, dogCapacity: { gte: dogCount } },
    orderBy: { dogCapacity: "asc" },
  })

  const requiredRank = requiredSize ? DOG_SIZE_ORDER.indexOf(requiredSize) : -1

  for (const unit of units) {
    if (requiredRank >= 0) {
      // kennelSizeRank returns null for text it can't map to a size (e.g.
      // "Kennel"-type labels) — treated as fits any size, not excluded.
      const unitRank = kennelSizeRank(unit.size)
      if (unitRank !== null && unitRank < requiredRank) continue
    }
    const [blocked, occupied] = await Promise.all([
      prisma.blockedDate.count({ where: { kennelUnitId: unit.id, date: { in: nights } } }),
      prisma.kennelOccupancy.count({ where: { kennelUnitId: unit.id, date: { in: nights } } }),
    ])
    if (blocked === 0 && occupied === 0) return unit
  }
  return null
}

async function isSlottedServiceAvailable(
  date: Date,
  serviceSlug: string,
  capacitySettingKey: string
): Promise<{ available: boolean; remaining: number; reason?: string }> {
  const day = startOfDay(date)

  // Day care and meet & greets are weekday-only.
  if (isWeekend(day)) {
    return { available: false, remaining: 0, reason: "This service isn't available on Saturdays or Sundays." }
  }

  const [capacitySetting, blocked, existingDogCount] = await Promise.all([
    prisma.setting.findUnique({ where: { key: capacitySettingKey } }),
    prisma.blockedDate.count({ where: { kennelUnitId: null, date: day } }),
    prisma.bookingDog.count({
      where: {
        booking: {
          startDate: day,
          service: { slug: serviceSlug },
          status: { notIn: ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_ADMIN", "NO_SHOW"] },
        },
      },
    }),
  ])

  if (blocked > 0) return { available: false, remaining: 0 }

  const capacity = Number(capacitySetting?.value ?? 0)
  const remaining = Math.max(0, capacity - existingDogCount)
  return { available: remaining > 0, remaining }
}

export async function isDaycareAvailable(
  date: Date
): Promise<{ available: boolean; remaining: number; reason?: string }> {
  return isSlottedServiceAvailable(date, "daycare", "daycare_max_capacity")
}

/**
 * Only one Meet & Greet appointment can run per day, regardless of how many
 * dogs are in that family's booking — unlike daycare, this counts existing
 * bookings for the day, not dogs.
 */
export async function isMeetGreetAvailable(
  date: Date
): Promise<{ available: boolean; remaining: number; reason?: string }> {
  const day = startOfDay(date)

  if (isWeekend(day)) {
    return { available: false, remaining: 0, reason: "This service isn't available on Saturdays or Sundays." }
  }

  const [blocked, existingBookingCount] = await Promise.all([
    prisma.blockedDate.count({ where: { kennelUnitId: null, date: day } }),
    prisma.booking.count({
      where: {
        startDate: day,
        service: { slug: "meet-greet" },
        status: { notIn: ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_ADMIN", "NO_SHOW"] },
      },
    }),
  ])

  if (blocked > 0) return { available: false, remaining: 0 }
  if (existingBookingCount > 0) {
    return {
      available: false,
      remaining: 0,
      reason: "There's already a Meet & Greet booked for this day — please choose another weekday.",
    }
  }
  return { available: true, remaining: 1 }
}

/**
 * Batched version of isDaycareAvailable/isMeetGreetAvailable for an entire
 * date range — a handful of queries instead of one round trip per candidate
 * day, so the booking calendar can highlight every available weekday in a
 * month at once.
 */
export async function listAvailableDays(
  serviceSlug: "daycare" | "meet-greet",
  rangeStart: Date,
  rangeEnd: Date
): Promise<string[]> {
  const today = startOfDay(new Date())
  const candidates: Date[] = []
  for (let d = startOfDay(rangeStart); d <= rangeEnd; d = addDays(d, 1)) {
    if (d >= today && !isWeekend(d)) candidates.push(d)
  }
  if (candidates.length === 0) return []

  const blocked = await prisma.blockedDate.findMany({
    where: { kennelUnitId: null, date: { in: candidates } },
    select: { date: true },
  })
  const blockedSet = new Set(blocked.map((b) => toDateInputValue(b.date)))

  if (serviceSlug === "meet-greet") {
    const bookings = await prisma.booking.findMany({
      where: {
        service: { slug: "meet-greet" },
        startDate: { in: candidates },
        status: { notIn: ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_ADMIN", "NO_SHOW"] },
      },
      select: { startDate: true },
    })
    const bookedSet = new Set(bookings.map((b) => toDateInputValue(b.startDate)))
    return candidates
      .map(toDateInputValue)
      .filter((d) => !blockedSet.has(d) && !bookedSet.has(d))
  }

  const [capacitySetting, bookingDogs] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "daycare_max_capacity" } }),
    prisma.bookingDog.findMany({
      where: {
        booking: {
          service: { slug: "daycare" },
          startDate: { in: candidates },
          status: { notIn: ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_ADMIN", "NO_SHOW"] },
        },
      },
      select: { booking: { select: { startDate: true } } },
    }),
  ])
  const capacity = Number(capacitySetting?.value ?? 0)
  const countByDay = new Map<string, number>()
  for (const bd of bookingDogs) {
    const d = toDateInputValue(bd.booking.startDate)
    countByDay.set(d, (countByDay.get(d) ?? 0) + 1)
  }
  return candidates
    .map(toDateInputValue)
    .filter((d) => !blockedSet.has(d) && (countByDay.get(d) ?? 0) < capacity)
}

export async function listAvailableWalkSlots(fromDate: Date) {
  const slots = await prisma.walkSlot.findMany({
    where: { date: { gte: startOfDay(fromDate) } },
    orderBy: [{ date: "asc" }, { time: "asc" }],
    include: { walkBookings: true },
  })
  return slots
    .map((slot) => ({ ...slot, remaining: slot.maxDogs - slot.walkBookings.length }))
    .filter((slot) => slot.remaining > 0)
}

export async function listAvailableVanRuns(fromDate: Date) {
  const runs = await prisma.vanRun.findMany({
    where: { date: { gte: startOfDay(fromDate) } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include: { stops: true },
  })
  return runs
    .map((run) => ({ ...run, remaining: run.maxDogs - run.stops.length }))
    .filter((run) => run.remaining > 0)
}
