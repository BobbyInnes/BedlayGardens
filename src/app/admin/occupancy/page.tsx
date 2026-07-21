import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { toDateInputValue, parseMonthParam, monthParamFor } from "@/lib/dates"

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

  const occupancyMap = new Map<string, (typeof occupancies)[number]>()
  for (const occ of occupancies) {
    occupancyMap.set(`${occ.kennelUnitId}:${toDateInputValue(occ.date)}`, occ)
  }
  const siteWideBlocked = new Set(
    blockedDates.filter((b) => !b.kennelUnitId).map((b) => toDateInputValue(b.date))
  )
  const kennelBlocked = new Set(
    blockedDates.filter((b) => b.kennelUnitId).map((b) => `${b.kennelUnitId}:${toDateInputValue(b.date)}`)
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Occupancy</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href={`/admin/occupancy?month=${monthParamFor(prevMonth.getFullYear(), prevMonth.getMonth())}`}
            className="font-medium text-primary hover:underline"
          >
            ← Prev
          </Link>
          <span className="font-medium">
            {monthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </span>
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
                    {day}
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
                  {days.map((day) => {
                    const dateKey = toDateInputValue(new Date(year, monthIndex, day))
                    const occ = occupancyMap.get(`${unit.id}:${dateKey}`)
                    const blocked = siteWideBlocked.has(dateKey) || kennelBlocked.has(`${unit.id}:${dateKey}`)

                    if (occ) {
                      return (
                        <td key={day} className="border-b border-border p-0">
                          <Link
                            href={`/admin/bookings/${occ.bookingId}`}
                            title={`${occ.booking.customer.name} — ${occ.booking.bookingDogs.map((bd) => bd.dog.name).join(", ")}`}
                            className="flex h-9 items-center justify-center bg-primary/15 text-[10px] font-medium text-primary hover:bg-primary/25"
                          >
                            {occ.booking.customer.name.split(" ")[0]}
                          </Link>
                        </td>
                      )
                    }
                    if (blocked) {
                      return (
                        <td
                          key={day}
                          title="Blocked"
                          className="h-9 border-b border-border bg-muted text-center text-muted-foreground"
                        >
                          ×
                        </td>
                      )
                    }
                    return <td key={day} className="h-9 border-b border-border" />
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded-sm bg-primary/15" /> Booked
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
