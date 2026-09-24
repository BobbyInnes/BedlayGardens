import { earliestCustomerBookableDateISO, isBeforeEarliestCustomerBookableDate } from "@/lib/dates"
import { isSameDayBookingBlocked } from "@/lib/service-slugs"

/**
 * Customer-facing booking rule: Day Care and Dog Walking can't be booked for
 * the current day or earlier, and from 10pm UK time tomorrow closes as well
 * (see earliestCustomerBookableDateISO). Returns the message to show, or null
 * if every date is fine. Mirrored in the booking date picker, which greys
 * those days out.
 *
 * Call this only from customer-initiated booking actions (the booking wizard
 * and waitlist claims). Admin manual bookings and the system-generated
 * subscription bookings deliberately don't use it.
 */
export function customerBookingDateError(
  serviceSlug: string,
  dates: (string | undefined)[]
): string | null {
  if (!isSameDayBookingBlocked(serviceSlug)) return null
  for (const raw of dates) {
    if (!raw) continue
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime()) && isBeforeEarliestCustomerBookableDate(parsed)) {
      const earliest = new Date(earliestCustomerBookableDateISO()).toLocaleDateString("en-GB", {
        timeZone: "UTC",
      })
      return `Day Care and Dog Walking can't be booked for today, and bookings for tomorrow close at 10pm. The earliest date available now is ${earliest} — please choose that date or later.`
    }
  }
  return null
}
