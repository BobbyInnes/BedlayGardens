// Every "calendar day" Date in this app is meant to be a UTC-midnight
// instant (that's what's stored in Postgres and what booking dates like
// `startDate`/`endDate` represent) — so every function here reads/writes
// using the UTC getters/setters explicitly, never the local ones. Bug fixed
// 2026-09-06: this used to use local setHours/getDate/getDay, which happened
// to work on Vercel (Node there always runs with TZ=UTC, so local === UTC)
// but silently broke on any machine running a different timezone — e.g. a
// UK dev machine on BST (UTC+1) computed nights.push(startOfDay(...)) at
// 23:00 UTC the day before, one hour off the UTC-midnight rows already in
// the database (KennelOccupancy, BlockedDate), so a kennel blocked for a
// given date was never actually matched and bookings for it went through
// as if it were free.
export function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setUTCHours(0, 0, 0, 0)
  return result
}

/** Saturday or Sunday, by the date's UTC day-of-week (see the note above —
 * every calendar day here is a UTC-midnight instant). */
export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay()
  return day === 0 || day === 6
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

/** Nights of a boarding stay: check-in date through the day before check-out. */
export function nightsBetween(startDate: Date, endDate: Date): Date[] {
  const nights: Date[] = []
  let current = startOfDay(startDate)
  const end = startOfDay(endDate)
  while (current < end) {
    nights.push(current)
    current = addDays(current, 1)
  }
  return nights
}

/**
 * yyyy-mm-dd for `<input type="date">` defaultValue, read from the UTC
 * calendar day — `startOfDay()` truncates to UTC midnight (see the note on
 * it above), so this has to read UTC components too or it can land on the
 * wrong day whenever the server's local timezone isn't UTC.
 */
export function toDateInputValue(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Parses a "YYYY-MM" query param, falling back to the current UTC month. */
export function parseMonthParam(monthParam: string | undefined): { year: number; monthIndex: number } {
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [year, month] = monthParam.split("-").map(Number)
    return { year, monthIndex: month - 1 }
  }
  const now = new Date()
  return { year: now.getUTCFullYear(), monthIndex: now.getUTCMonth() }
}

export function monthParamFor(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`
}

/**
 * Parses a "YYYY-MM-DD" query param, falling back to today. Builds the date
 * from its UTC components explicitly via `Date.UTC` rather than either
 * `new Date(year, month, day)` (local midnight) or `new Date(dateParam)`
 * (also fine here, since date-only ISO strings already parse as UTC
 * midnight — but spelling it out keeps this consistent with the rest of
 * this file) — see the note on `startOfDay` above.
 */
export function parseDateParam(dateParam: string | undefined): Date {
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const [year, month, day] = dateParam.split("-").map(Number)
    const parsed = new Date(Date.UTC(year, month - 1, day))
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return startOfDay(new Date())
}

export function isSameDay(a: Date, b: Date): boolean {
  return toDateInputValue(a) === toDateInputValue(b)
}

// Day Care half-day AM sessions run in the morning — once it's this late in
// the day, "AM" no longer describes a real window for a same-day booking, so
// the half-day slot is forced to PM past this point. Only matters for a
// booking dated today; a future date is unaffected regardless of the time
// right now. Shared by the booking wizard's UI (which locks the AM/PM select
// to PM) and resolveBookingCreation's server-side check.
const DAYCARE_HALF_DAY_AM_CUTOFF_MINUTES = 12 * 60 + 30 // 12:30pm

export function isPastDaycareHalfDayAmCutoff(date: Date, now: Date = new Date()): boolean {
  if (!isSameDay(date, now)) return false
  return now.getHours() * 60 + now.getMinutes() >= DAYCARE_HALF_DAY_AM_CUTOFF_MINUTES
}
