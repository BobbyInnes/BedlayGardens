import { prisma } from "@/lib/prisma"

const ACTIVE_STATUSES_EXCLUDED = ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_ADMIN", "NO_SHOW"] as const

export type DogBookingConflict = {
  dogId: string
  dogName: string
  existingBookingId: string
  existingServiceName: string
  existingStartDate: Date
  existingEndDate: Date
}

// Deliberately inclusive on both ends, unlike nightsBetween/KennelOccupancy
// (which treat a stay's checkout day as free, since a different booking can
// use the same physical kennel that day). This check isn't about kennel
// inventory — it's "is this dog already committed to a service on this
// date" — and the dog is still with the boarding provider on its checkout
// day, so that day counts as occupied here even though the kennel itself
// doesn't.
function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

/**
 * Finds a dog's other active bookings — for ANY service — whose date range
 * overlaps the given range. A dog can only be booked into one service at a
 * time, so this both catches the same service booked twice for overlapping
 * dates and a dog double-booked into two different services on the same
 * day (e.g. Day Care and Home Boarding both covering the same date).
 * Filtered in application code rather than in the query because the two
 * sides being compared can each be either shape (point-in-time or ranged)
 * once we're no longer scoping to a single service.
 */
export async function findDogBookingConflicts(
  dogIds: string[],
  startDate: Date,
  endDate: Date,
  options?: { excludeBookingId?: string }
): Promise<DogBookingConflict[]> {
  if (dogIds.length === 0) return []

  const bookingDogs = await prisma.bookingDog.findMany({
    where: {
      dogId: { in: dogIds },
      booking: {
        id: options?.excludeBookingId ? { not: options.excludeBookingId } : undefined,
        status: { notIn: [...ACTIVE_STATUSES_EXCLUDED] },
      },
    },
    include: { dog: true, booking: { include: { service: true } } },
  })

  return bookingDogs
    .filter((bd) => rangesOverlap(startDate, endDate, bd.booking.startDate, bd.booking.endDate))
    .map((bd) => ({
      dogId: bd.dogId,
      dogName: bd.dog.name,
      existingBookingId: bd.bookingId,
      existingServiceName: bd.booking.service.name,
      existingStartDate: bd.booking.startDate,
      existingEndDate: bd.booking.endDate,
    }))
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB")
}

function formatDateRange(start: Date, end: Date): string {
  return start.getTime() === end.getTime() ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`
}

export type DogBookingConflictEntry = {
  dogName: string
  existingServiceName: string
  existingDateRange: string
}

export function formatDogBookingConflicts(conflicts: DogBookingConflict[]): DogBookingConflictEntry[] {
  return conflicts.map((c) => ({
    dogName: c.dogName,
    existingServiceName: c.existingServiceName,
    existingDateRange: formatDateRange(c.existingStartDate, c.existingEndDate),
  }))
}

export function formatDogBookingConflictMessage(conflicts: DogBookingConflict[]): string {
  const details = conflicts
    .map((c) => `${c.dogName} already has a ${c.existingServiceName} booking for ${formatDateRange(c.existingStartDate, c.existingEndDate)}`)
    .join("; ")
  return `${details} — a dog can only be booked into one service at a time. Pick different dates, remove the dog, or cancel the existing booking first.`
}
