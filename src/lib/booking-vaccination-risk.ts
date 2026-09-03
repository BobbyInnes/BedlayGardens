// Bridges a gap the vaccination gate doesn't cover on its own: it's only
// ever evaluated at booking creation and again at staff check-in (see
// src/lib/vaccination-gate.ts). A booking made well in advance can be fully
// compliant when placed and still quietly drift out of date by the time the
// stay arrives, with nobody finding out until check-in day. This scans
// upcoming bookings ahead of time so the cron (customer email) and the admin
// dashboard (staff visibility) can both surface it early — same underlying
// check, same results, so the two views can't disagree.
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { checkVaccinationGate } from "@/lib/vaccination-gate"
import { today } from "@/lib/staff-dates"
import { addDays } from "@/lib/dates"

const atRiskBookingInclude = {
  customer: true,
  service: true,
  bookingDogs: { include: { dog: true } },
} satisfies Prisma.BookingInclude
type AtRiskBookingRecord = Prisma.BookingGetPayload<{ include: typeof atRiskBookingInclude }>

export type AtRiskBooking = {
  booking: AtRiskBookingRecord
  perDog: { dogId: string; dogName: string; missingTypes: string[] }[]
}

/**
 * Upcoming bookings (starting within `windowDays`) whose dogs won't be
 * currently vaccinated for the whole stay. Checked against `endDate`, same
 * as the staff check-in gate, so a dog valid on day one but lapsing partway
 * through a boarding stay still counts as at risk.
 */
export async function findAtRiskBookings(windowDays: number): Promise<AtRiskBooking[]> {
  const windowEnd = addDays(today(), windowDays)
  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
      startDate: { gte: today(), lte: windowEnd },
    },
    include: atRiskBookingInclude,
    orderBy: { startDate: "asc" },
  })

  const results: AtRiskBooking[] = []
  for (const booking of bookings) {
    const dogIds = booking.bookingDogs.map((bd) => bd.dogId)
    const gate = await checkVaccinationGate(dogIds, booking.endDate)
    if (!gate.ok) {
      results.push({ booking, perDog: gate.perDog.filter((d) => d.missingTypes.length > 0) })
    }
  }
  return results
}
