import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { fullName } from "@/lib/format"
import { parseMonthParam } from "@/lib/dates"
import {
  DOG_SIZE_ORDER,
  DOG_SIZE_LABELS,
  UNKNOWN_SIZE_COLOR,
  UNKNOWN_SIZE_LABEL,
  colorForDogSize,
} from "@/lib/dog-size-colors"
import { DAYCARE_SLUGS } from "@/lib/service-slugs"
import { OccupancyToolbar } from "../_components/occupancy-toolbar"

export const metadata: Metadata = {
  title: "Day Care | Admin",
}

const EXCLUDED_STATUSES = ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_ADMIN", "NO_SHOW"] as const

export default async function AdminDayCarePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; dog?: string; owner?: string }>
}) {
  const { month, dog: dogFilter = "", owner: ownerFilter = "" } = await searchParams
  const { year, monthIndex } = parseMonthParam(month)

  const monthStart = new Date(year, monthIndex, 1)
  const monthEnd = new Date(year, monthIndex + 1, 1)
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const daycareBookings = await prisma.booking.findMany({
    where: {
      service: { slug: { in: [...DAYCARE_SLUGS] } },
      status: { notIn: [...EXCLUDED_STATUSES] },
      startDate: { gte: monthStart, lt: monthEnd },
    },
    include: { customer: true, bookingDogs: { include: { dog: true } } },
    orderBy: { startDate: "asc" },
  })

  function matchesFilter(dogName: string, ownerName: string, ownerEmail: string): boolean {
    const dogOk = !dogFilter.trim() || dogName.toLowerCase().includes(dogFilter.trim().toLowerCase())
    const ownerOk =
      !ownerFilter.trim() ||
      ownerName.toLowerCase().includes(ownerFilter.trim().toLowerCase()) ||
      ownerEmail.toLowerCase().includes(ownerFilter.trim().toLowerCase())
    return dogOk && ownerOk
  }

  // One row per dog with any daycare booking this month. Consecutive days
  // merge into a single bar even though each day is its own Booking record
  // (daycare bookings are created one per date, not as a single multi-day
  // stay) — the merge is keyed on dog + adjacency, not on a shared booking id.
  type DaycareBooking = (typeof daycareBookings)[number]
  type DaycareSegment = { startDay: number; span: number; bookings: DaycareBooking[]; dog: DaycareBooking["bookingDogs"][number]["dog"]; owner: DaycareBooking["customer"] }

  const daycareByDogAndDay = new Map<string, Map<number, DaycareBooking>>()
  const dogsById = new Map<string, { dog: DaycareBooking["bookingDogs"][number]["dog"]; owner: DaycareBooking["customer"] }>()
  for (const booking of daycareBookings) {
    const day = booking.startDate.getDate()
    for (const bd of booking.bookingDogs) {
      const byDay = daycareByDogAndDay.get(bd.dogId) ?? new Map<number, DaycareBooking>()
      byDay.set(day, booking)
      daycareByDogAndDay.set(bd.dogId, byDay)
      dogsById.set(bd.dogId, { dog: bd.dog, owner: booking.customer })
    }
  }

  const daycareDogIds = [...dogsById.entries()]
    .filter(([, { dog, owner }]) => matchesFilter(dog.name, fullName(owner), owner.email))
    .map(([dogId]) => dogId)
    .sort((a, b) => (dogsById.get(a)!.dog.name < dogsById.get(b)!.dog.name ? -1 : 1))

  function segmentsForDog(dogId: string): DaycareSegment[] {
    const byDay = daycareByDogAndDay.get(dogId)!
    const { dog, owner } = dogsById.get(dogId)!
    const segments: DaycareSegment[] = []
    for (const day of days) {
      const booking = byDay.get(day)
      if (!booking) continue
      const last = segments[segments.length - 1]
      if (last && last.startDay + last.span === day) {
        last.span += 1
        last.bookings.push(booking)
      } else {
        segments.push({ startDay: day, span: 1, bookings: [booking], dog, owner })
      }
    }
    return segments
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Day Care</h1>
        <p className="text-sm text-muted-foreground">
          {monthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </p>
      </div>

      <OccupancyToolbar
        basePath="/admin/occupancy/day-care"
        year={year}
        monthIndex={monthIndex}
        dogFilter={dogFilter}
        ownerFilter={ownerFilter}
      />

      {daycareDogIds.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {dogFilter || ownerFilter
            ? "No day care bookings match those filters this month."
            : "No day care bookings this month."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border-b border-r border-border bg-background p-2 text-left font-medium">
                  Dog
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
              {daycareDogIds.map((dogId) => {
                const { dog, owner } = dogsById.get(dogId)!
                const segments = segmentsForDog(dogId)
                const size = colorForDogSize(dog.size)
                const cells: React.ReactNode[] = []
                let day = 1
                for (const seg of segments) {
                  if (seg.startDay > day) {
                    cells.push(
                      <td
                        key={`empty-${day}`}
                        colSpan={seg.startDay - day}
                        className="h-9 border-b border-border"
                      />
                    )
                  }
                  cells.push(
                    <td key={`seg-${seg.startDay}`} colSpan={seg.span} className="border-b border-border p-0">
                      <Link
                        href={`/admin/bookings/${seg.bookings[0].id}`}
                        title={`${fullName(owner)} — ${dog.name} (${dog.breed})`}
                        className={`flex h-9 items-center justify-center truncate px-1 text-[10px] font-medium text-white hover:opacity-90 ${size}`}
                      >
                        {dog.name} — {fullName(owner)}
                      </Link>
                    </td>
                  )
                  day = seg.startDay + seg.span
                }
                if (day <= daysInMonth) {
                  cells.push(
                    <td key={`empty-${day}`} colSpan={daysInMonth - day + 1} className="h-9 border-b border-border" />
                  )
                }
                return (
                  <tr key={dogId}>
                    <td className="sticky left-0 z-10 whitespace-nowrap border-r border-b border-border bg-background p-2 font-medium">
                      {dog.name} <span className="font-normal text-muted-foreground">— {fullName(owner)}</span>
                    </td>
                    {cells}
                  </tr>
                )
              })}
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
      </div>
    </div>
  )
}
