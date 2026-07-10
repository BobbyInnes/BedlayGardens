import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { today } from "@/lib/staff-dates"

export const metadata: Metadata = {
  title: "Overview | Admin",
}

export default async function AdminOverviewPage() {
  const date = today()

  const [kennelCount, occupiedCount, arrivalsToday, pendingVaccinations, totalCustomers] =
    await Promise.all([
      prisma.kennelUnit.count({ where: { active: true } }),
      prisma.kennelOccupancy.count({ where: { date } }),
      prisma.booking.count({
        where: { startDate: date, status: { in: ["PENDING_PAYMENT", "CONFIRMED"] } },
      }),
      prisma.vaccinationRecord.count({ where: { status: "UNVERIFIED" } }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
    ])

  const occupancyPercent = kennelCount > 0 ? Math.round((occupiedCount / kennelCount) * 100) : 0

  const stats = [
    { label: "Kennel occupancy today", value: `${occupancyPercent}%`, href: "/admin/occupancy" },
    { label: "Arrivals today", value: arrivalsToday, href: "/admin/bookings" },
    { label: "Vaccinations to verify", value: pendingVaccinations, href: "/admin/vaccinations" },
    { label: "Total customers", value: totalCustomers, href: "/admin/customers" },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{stat.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
