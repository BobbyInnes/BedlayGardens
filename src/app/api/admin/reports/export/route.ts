import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { parseMonthParam } from "@/lib/dates"

function csvField(value: string | number): string {
  const str = String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const { year, monthIndex } = parseMonthParam(searchParams.get("month") ?? undefined)
  const monthStart = new Date(year, monthIndex, 1)
  const monthEnd = new Date(year, monthIndex + 1, 1)

  const bookings = await prisma.booking.findMany({
    where: { startDate: { gte: monthStart, lt: monthEnd } },
    include: { service: true, customer: true },
    orderBy: { startDate: "asc" },
  })

  const header = [
    "Booking ID",
    "Customer",
    "Email",
    "Service",
    "Start Date",
    "End Date",
    "Status",
    "Total (GBP)",
  ]
  const rows = bookings.map((b) => [
    b.id,
    b.customer.name,
    b.customer.email,
    b.service.name,
    b.startDate.toLocaleDateString("en-GB"),
    b.endDate.toLocaleDateString("en-GB"),
    b.status,
    (b.totalPence / 100).toFixed(2),
  ])

  const csv = [header, ...rows].map((row) => row.map(csvField).join(",")).join("\n")
  const filename = `bookings-${year}-${String(monthIndex + 1).padStart(2, "0")}.csv`

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
