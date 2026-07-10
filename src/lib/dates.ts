export function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
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
