export function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

/** Saturday or Sunday. Uses the date's local day-of-week (server runs in UTC,
 * and booking dates are UTC-midnight, so this is the calendar day's weekday). */
export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
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
 * yyyy-mm-dd in local time, for `<input type="date">` defaultValue.
 * `startOfDay()` truncates in local time, so a UTC-based `toISOString().slice(0, 10)`
 * reads one day early whenever local time is ahead of UTC (e.g. BST).
 */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Parses a "YYYY-MM" query param, falling back to the current month. */
export function parseMonthParam(monthParam: string | undefined): { year: number; monthIndex: number } {
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [year, month] = monthParam.split("-").map(Number)
    return { year, monthIndex: month - 1 }
  }
  const now = new Date()
  return { year: now.getFullYear(), monthIndex: now.getMonth() }
}

export function monthParamFor(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`
}

/**
 * Parses a "YYYY-MM-DD" query param, falling back to today. Builds the date
 * from local-time components directly (like `parseMonthParam`) rather than
 * `new Date(dateParam)`, which parses date-only ISO strings as UTC midnight
 * and can land on the wrong local day — see `toDateInputValue` above.
 */
export function parseDateParam(dateParam: string | undefined): Date {
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const [year, month, day] = dateParam.split("-").map(Number)
    const parsed = new Date(year, month - 1, day)
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
