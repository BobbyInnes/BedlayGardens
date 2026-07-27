import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { toDateInputValue, parseMonthParam, monthParamFor } from "@/lib/dates"
import {
  DOG_SIZE_ORDER,
  DOG_SIZE_LABELS,
  UNKNOWN_SIZE_COLOR,
  UNKNOWN_SIZE_LABEL,
  largestDogSize,
  colorForDogSize,
} from "@/lib/dog-size-colors"

export const metadata: Metadata = {
  title: "Occupancy | Admin",
}

export default async function AdminOccupancyPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month } = await searchParams
  const { year, monthIndex } = parseMonthParam(month)

  const monthStart = new Date(year, monthIndex, 1)
  const monthEnd = new Date(year, monthIndex + 1, 1)
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const prevMonth = new Date(year, monthIndex - 1, 1)
  const nextMonth = new Date(year, monthIndex + 1, 1)

  const [kennelUnits, occupancies, blockedDates] = await Promise.all([
    prisma.kennelUnit.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.kennelOccupancy.findMany({
      where: { date: { gte: monthStart, lt: monthEnd } },
      include: { booking: { include: { customer: true, bookingDogs: { include: { dog: true } } } } },
    }),
    prisma.blockedDate.findMany({ where: { date: { gte: monthStart, lt: monthEnd } } }),
  ])

  type Occupancy = (typeof occupancies)[number]
  type Segment =
    | { kind: "booked"; startDay: number; span: number; occ: Occupancy }
    | { kind: "blocked"; startDay: number; span: number }
    | { kind: "empty"; startDay: number; span: number }

  const occupancyMap = new Map<string, Occupancy>()
  const petsByDay = new Map<number, Set<string>>()
  for (const occ of occupancies) {
    occupancyMap.set(`${occ.kennelUnitId}:${toDateInputValue(occ.date)}`, occ)
    const day = occ.date.getDate()
    const dogIds = petsByDay.get(day) ?? new Set<string>()
    for (const bd of occ.booking.bookingDogs) dogIds.add(bd.dogId)
    petsByDay.set(day, dogIds)
  }
  const siteWideBlocked = new Set(
    blockedDates.filter((b) => !b.kennelUnitId).map((b) => toDateInputValue(b.date))
  )
  const kennelBlocked = new Set(
    blockedDates.filter((b) => b.kennelUnitId).map((b) => `${b.kennelUnitId}:${toDateInputValue(b.date)}`)
  )

  const totalUnitNights = kennelUnits.length * daysInMonth
  const occupancyPct = totalUnitNights > 0 ? (occupancies.length / totalUnitNights) * 100 : 0

  function segmentsForUnit(unitId: string): Segment[] {
    const segments: Segment[] = []
    for (const day of days) {
      const dateKey = toDateInputValue(new Date(year, monthIndex, day))
      const occ = occupancyMap.get(`${unitId}:${dateKey}`)
      const blocked = siteWideBlocked.has(dateKey) || kennelBlocked.has(`${unitId}:${dateKey}`)
      const last = segments[segments.length - 1]

      if (occ) {
        if (last?.kind === "booked" && last.occ.bookingId === occ.bookingId) {
          last.span += 1
        } else {
          segments.push({ kind: "booked", startDay: day, span: 1, occ })
        }
      } else if (blocked) {
        if (last?.kind === "blocked") last.span += 1
        else segments.push({ kind: "blocked", startDay: day, span: 1 })
      } else {
        if (last?.kind === "empty") last.span += 1
        else segments.push({ kind: "empty", startDay: day, span: 1 })
      }
    }
    return segments
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Occupancy</h1>
          <p className="text-sm text-muted-foreground">
            {monthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" })} — {occupancyPct.toFixed(2)}%
            occupancy
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href={`/admin/occupancy?month=${monthParamFor(prevMonth.getFullYear(), prevMonth.getMonth())}`}
            className="font-medium text-primary hover:underline"
          >
            ← Prev
          </Link>
          <Link
            href={`/admin/occupancy?month=${monthParamFor(nextMonth.getFullYear(), nextMonth.getMonth())}`}
            className="font-medium text-primary hover:underline"
          >
            Next →
          </Link>
        </div>
      </div>

      {kennelUnits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active accommodation units configured.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border-b border-r border-border bg-background p-2 text-left font-medium">
                  Crate
                </th>
                {days.map((day) => (
                  <th
                    key={day}
                    className="min-w-14 border-b border-border p-1 text-center font-medium text-muted-foreground"
                  >
                    <div>{day}</div>
                    <div className="text-[9px] font-normal">{petsByDay.get(day)?.size ?? 0} pets</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kennelUnits.map((unit) => (
                <tr key={unit.id}>
                  <td className="sticky left-0 z-10 whitespace-nowrap border-r border-b border-border bg-background p-2 font-medium">
                    {unit.name}
                  </td>
                  {segmentsForUnit(unit.id).map((seg) => {
                    if (seg.kind === "booked") {
                      const dogs = seg.occ.booking.bookingDogs.map((bd) => bd.dog)
                      const size = largestDogSize(dogs.map((d) => d.size))
                      const color = colorForDogSize(size)
                      const label = dogs.map((d) => d.name).join(", ")
                      return (
                        <td key={seg.startDay} colSpan={seg.span} className="border-b border-border p-0">
                          <Link
                            href={`/admin/bookings/${seg.occ.bookingId}`}
                            title={`${seg.occ.booking.customer.name} — ${label}${size ? ` (${DOG_SIZE_LABELS[size]})` : ""}`}
                            className={`flex h-9 items-center justify-center truncate px-1 text-[10px] font-medium text-white hover:opacity-90 ${color}`}
                          >
                            {label}
                          </Link>
                        </td>
                      )
                    }
                    if (seg.kind === "blocked") {
                      return (
                        <td
                          key={seg.startDay}
                          colSpan={seg.span}
                          title="Blocked"
                          className="h-9 border-b border-border bg-muted text-center text-muted-foreground"
                        >
                          ×
                        </td>
                      )
                    }
                    return <td key={seg.startDay} colSpan={seg.span} className="h-9 border-b border-border" />
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {DOG_SIZE_ORDER.map((size) => (
          <span key={size} className="flex items-center gap-1">
            <span className={`inline-block size-3 rounded-sm ${colorForDogSize(size)}`} /> {DOG_SIZE_LABELS[size]}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className={`inline-block size-3 rounded-sm ${UNKNOWN_SIZE_COLOR}`} /> {UNKNOWN_SIZE_LABEL}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded-sm bg-muted" /> Blocked
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded-sm border border-border" /> Available
        </span>
      </div>
    </div>
  )
}
