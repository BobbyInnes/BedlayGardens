import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { toDateInputValue, parseMonthParam, monthParamFor, nightsBetween } from "@/lib/dates"
import { buildServiceColorMap } from "@/lib/service-colors"

export const metadata: Metadata = {
  title: "Calendar | Admin",
}

// Bookings in these statuses don't represent a real, going-ahead booking, so
// they're left out of the day counts.
const EXCLUDED_STATUSES = ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_ADMIN", "NO_SHOW"] as const

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month } = await searchParams
  const { year, monthIndex } = parseMonthParam(month)

  const monthStart = new Date(year, monthIndex, 1)
  const monthEnd = new Date(year, monthIndex + 1, 1)
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()

  const prevMonth = new Date(year, monthIndex - 1, 1)
  const nextMonth = new Date(year, monthIndex + 1, 1)

  const [services, bookings] = await Promise.all([
    prisma.service.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.booking.findMany({
      where: {
        status: { notIn: [...EXCLUDED_STATUSES] },
        startDate: { lt: monthEnd },
        endDate: { gte: monthStart },
      },
      select: { serviceId: true, startDate: true, endDate: true },
    }),
  ])

  const colorByServiceId = buildServiceColorMap(services)

  // dateKey -> serviceId -> count of bookings covering that day
  const countsByDate = new Map<string, Map<string, number>>()
  for (const booking of bookings) {
    const days =
      booking.endDate.getTime() === booking.startDate.getTime()
        ? [booking.startDate]
        : nightsBetween(booking.startDate, booking.endDate)

    for (const day of days) {
      if (day < monthStart || day >= monthEnd) continue
      const dateKey = toDateInputValue(day)
      const dayCounts = countsByDate.get(dateKey) ?? new Map<string, number>()
      dayCounts.set(booking.serviceId, (dayCounts.get(booking.serviceId) ?? 0) + 1)
      countsByDate.set(dateKey, dayCounts)
    }
  }

  // Monday-first grid: figure out how many blank leading cells the 1st needs.
  const firstWeekday = monthStart.getDay() // 0 = Sun … 6 = Sat
  const leadingBlanks = (firstWeekday + 6) % 7
  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const today = toDateInputValue(new Date())

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href={`/admin/calendar?month=${monthParamFor(prevMonth.getFullYear(), prevMonth.getMonth())}`}
            className="font-medium text-primary hover:underline"
          >
            ← Prev
          </Link>
          <span className="font-medium">
            {monthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </span>
          <Link
            href={`/admin/calendar?month=${monthParamFor(nextMonth.getFullYear(), nextMonth.getMonth())}`}
            className="font-medium text-primary hover:underline"
          >
            Next →
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] border-collapse text-xs">
          <thead>
            <tr>
              {WEEKDAY_LABELS.map((label) => (
                <th
                  key={label}
                  className="border-b border-border bg-muted/50 p-2 text-left font-medium text-muted-foreground"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, weekIndex) => (
              <tr key={weekIndex}>
                {week.map((day, dayIndex) => {
                  if (day === null) {
                    return (
                      <td
                        key={dayIndex}
                        className="h-24 border-b border-r border-border bg-muted/20 align-top last:border-r-0"
                      />
                    )
                  }
                  const dateKey = toDateInputValue(new Date(year, monthIndex, day))
                  const dayCounts = countsByDate.get(dateKey)
                  const isToday = dateKey === today

                  return (
                    <td
                      key={dayIndex}
                      className="h-24 min-w-24 border-b border-r border-border p-1.5 align-top last:border-r-0"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={
                            isToday
                              ? "flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground"
                              : "text-[11px] font-medium text-muted-foreground"
                          }
                        >
                          {day}
                        </span>
                      </div>
                      {dayCounts && dayCounts.size > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {[...dayCounts.entries()].map(([serviceId, count]) => {
                            const service = services.find((s) => s.id === serviceId)
                            return (
                              <div
                                key={serviceId}
                                title={service?.name ?? "Unknown service"}
                                className="flex items-center gap-1 truncate rounded bg-muted px-1 py-0.5 text-[10px] font-medium"
                              >
                                <span
                                  className={`inline-block size-2 shrink-0 rounded-full ${colorByServiceId.get(serviceId) ?? "bg-gray-400"}`}
                                />
                                <span className="truncate">{service?.name ?? "Unknown"}</span>
                                <span className="ml-auto shrink-0 text-muted-foreground">{count}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {services.map((service) => (
          <span key={service.id} className="flex items-center gap-1.5">
            <span
              className={`inline-block size-3 rounded-sm ${colorByServiceId.get(service.id) ?? "bg-gray-400"}`}
            />
            {service.name}
          </span>
        ))}
      </div>
    </div>
  )
}
