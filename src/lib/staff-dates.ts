import { startOfDay, addDays } from "@/lib/dates"

export function today(): Date {
  return startOfDay(new Date())
}

export function tomorrow(): Date {
  return addDays(today(), 1)
}
