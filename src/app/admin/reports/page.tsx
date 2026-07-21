import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import { formatPence } from "@/lib/format"
import { startOfDay, addDays, parseMonthParam, monthParamFor } from "@/lib/dates"
import type { BookingStatus } from "@/generated/prisma/client"

export const metadata: Metadata = {
  title: "Reports | Admin",
}

const EXCLUDED_STATUSES: BookingStatus[] = [
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_ADMIN",
  "NO_SHOW",
  "DRAFT",
]

export default async function AdminReportsPage({
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

  const today = startOfDay(new Date())
  const weekAhead = addDays(today, 7)

  const [activeKennelCount, occupiedNights, revenueByService, upcomingBookings] = await Promise.all([
    prisma.kennelUnit.count({ where: { active: true } }),
    prisma.kennelOccupancy.count({ where: { date: { gte: monthStart, lt: monthEnd } } }),
    prisma.booking.groupBy({
      by: ["serviceId"],
      where: {
        startDate: { gte: monthStart, lt: monthEnd },
        status: { notIn: EXCLUDED_STATUSES },
      },
      _sum: { totalPence: true },
      _count: { _all: true },
    }),
    prisma.booking.findMany({
      where: {
        startDate: { gte: today, lt: weekAhead },
        status: { notIn: EXCLUDED_STATUSES },
      },
      include: { service: true, customer: true },
      orderBy: { startDate: "asc" },
    }),
  ])

  const services = await prisma.service.findMany({
    where: { id: { in: revenueByService.map((r) => r.serviceId) } },
  })
  const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? "Unknown"

  const totalRevenuePence = revenueByService.reduce((sum, r) => sum + (r._sum.totalPence ?? 0), 0)
  const occupancyPercent =
    activeKennelCount > 0
      ? Math.round((occupiedNights / (activeKennelCount * daysInMonth)) * 100)
      : 0

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href={`/admin/reports?month=${monthParamFor(prevMonth.getFullYear(), prevMonth.getMonth())}`}
            className="font-medium text-primary hover:underline"
          >
            ← Prev
          </Link>
          <span className="font-medium">
            {monthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </span>
          <Link
            href={`/admin/reports?month=${monthParamFor(nextMonth.getFullYear(), nextMonth.getMonth())}`}
            className="font-medium text-primary hover:underline"
          >
            Next →
          </Link>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/api/admin/reports/export?month=${monthParamFor(year, monthIndex)}`}>
              Export CSV
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">
              Accommodation occupancy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{occupancyPercent}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">
              Revenue this month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{formatPence(totalRevenuePence)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">
              Bookings in next 7 days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{upcomingBookings.length}</p>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Revenue by service</h2>
        {revenueByService.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {revenueByService.map((row) => (
              <li key={row.serviceId} className="flex items-center justify-between p-3 text-sm">
                <span>
                  {serviceName(row.serviceId)} ({row._count._all} booking
                  {row._count._all === 1 ? "" : "s"})
                </span>
                <span className="font-medium">{formatPence(row._sum.totalPence ?? 0)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No bookings this month.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Upcoming week forecast</h2>
        {upcomingBookings.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {upcomingBookings.map((booking) => (
              <li key={booking.id} className="flex items-center justify-between p-3">
                <span>
                  {booking.startDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}{" "}
                  — {booking.service.name} — {booking.customer.name}
                </span>
                <span className="text-muted-foreground">{formatPence(booking.totalPence)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No bookings in the next 7 days.</p>
        )}
      </section>
    </div>
  )
}
