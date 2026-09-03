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
import { sendEmail } from "@/lib/email"
import { getSettings } from "@/lib/settings"
import { pendingVaccinationResolvedEmail } from "@/lib/email-templates"

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

/**
 * PENDING_VACCINATION bookings — placed despite a failed vaccination gate
 * (see proceedWithoutValidVaccines in book/actions.ts), still unresolved.
 * Unlike findAtRiskBookings above these were never confirmed to begin with,
 * but the shape is the same so the admin dashboard can list both together.
 */
export async function findPendingVaccinationBookings(): Promise<AtRiskBooking[]> {
  const bookings = await prisma.booking.findMany({
    where: { status: "PENDING_VACCINATION" },
    include: atRiskBookingInclude,
    orderBy: { startDate: "asc" },
  })

  const results: AtRiskBooking[] = []
  for (const booking of bookings) {
    const dogIds = booking.bookingDogs.map((bd) => bd.dogId)
    // Should always still fail by definition of the status — re-checked
    // anyway for an accurate per-dog summary, and as a safety net in case
    // something updated the booking without going through the shared
    // confirm path (checkPendingVaccinationBookings below).
    const gate = await checkVaccinationGate(dogIds, booking.endDate)
    if (!gate.ok) {
      results.push({ booking, perDog: gate.perDog.filter((d) => d.missingTypes.length > 0) })
    }
  }
  return results
}

/**
 * Called after a vaccination record is created for a dog (see
 * createVaccinationManual / saveExtractedVaccinations) — mirrors
 * checkWaitlistAfterVaccination's role for the capacity waitlist, but for
 * PENDING_VACCINATION bookings: re-checks each of the dog's pending
 * bookings and auto-confirms any the new record now covers.
 */
export async function checkPendingVaccinationBookings(dogId: string): Promise<void> {
  const bookings = await prisma.booking.findMany({
    where: { status: "PENDING_VACCINATION", bookingDogs: { some: { dogId } } },
    include: { service: true, customer: true, bookingDogs: true },
  })
  if (bookings.length === 0) return

  const settings = await getSettings()
  for (const booking of bookings) {
    const gate = await checkVaccinationGate(
      booking.bookingDogs.map((bd) => bd.dogId),
      booking.endDate
    )
    if (!gate.ok) continue
    await prisma.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED" } })
    const email = pendingVaccinationResolvedEmail(settings, {
      serviceName: booking.service.name,
      startDate: booking.startDate,
    })
    await sendEmail({ to: booking.customer.email, subject: email.subject, html: email.html })
  }
}
