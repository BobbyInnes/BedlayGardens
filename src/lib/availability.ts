import { prisma } from "@/lib/prisma"
import { isWeekend, nightsBetween, startOfDay } from "@/lib/dates"

async function isSiteWideBlocked(dates: Date[]): Promise<boolean> {
  const count = await prisma.blockedDate.count({
    where: { kennelUnitId: null, date: { in: dates } },
  })
  return count > 0
}

/**
 * Returns the first active kennel unit big enough for `dogCount` that is free
 * for every night of the stay (not blocked, no existing occupancy). Does not
 * reserve anything — call this for a preview; booking creation re-checks and
 * reserves atomically inside a transaction.
 */
export async function findAvailableKennelUnit(
  startDate: Date,
  endDate: Date,
  dogCount: number
) {
  const nights = nightsBetween(startDate, endDate)
  if (nights.length === 0) return null
  if (await isSiteWideBlocked(nights)) return null

  const units = await prisma.kennelUnit.findMany({
    where: { active: true, dogCapacity: { gte: dogCount } },
    orderBy: { dogCapacity: "asc" },
  })

  for (const unit of units) {
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

export async function isMeetGreetAvailable(
  date: Date
): Promise<{ available: boolean; remaining: number; reason?: string }> {
  return isSlottedServiceAvailable(date, "meet-greet", "meet_greet_max_capacity")
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
