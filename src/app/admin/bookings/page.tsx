import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatPence } from "@/lib/format"
import type { BookingStatus } from "@/generated/prisma/client"

export const metadata: Metadata = {
  title: "Bookings | Admin",
}

const STATUS_OPTIONS: BookingStatus[] = [
  "DRAFT",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "COMPLETED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_ADMIN",
  "NO_SHOW",
]

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; service?: string; status?: string }>
}) {
  const {
    q = "",
    service: serviceParam = "",
    status: statusParam = "",
  } = await searchParams
  const service = serviceParam === "ALL" ? "" : serviceParam
  const status = statusParam === "ALL" ? "" : statusParam

  const [bookings, services] = await Promise.all([
    prisma.booking.findMany({
      where: {
        ...(q.trim()
          ? {
              customer: {
                OR: [{ name: { contains: q.trim() } }, { email: { contains: q.trim() } }],
              },
            }
          : {}),
        ...(service ? { service: { slug: service } } : {}),
        ...(status ? { status: status as BookingStatus } : {}),
      },
      include: { customer: true, service: true },
      orderBy: { startDate: "desc" },
      take: 100,
    }),
    prisma.service.findMany({ orderBy: { sortOrder: "asc" } }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
        <Button size="sm" asChild>
          <Link href="/admin/bookings/new">Create manual booking</Link>
        </Button>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="q">Customer name or email</Label>
          <Input id="q" name="q" defaultValue={q} className="w-64" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="service">Service</Label>
          <Select name="service" defaultValue={service || "ALL"}>
            <SelectTrigger id="service" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All services</SelectItem>
              {services.map((svc) => (
                <SelectItem key={svc.id} value={svc.slug}>
                  {svc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={status || "ALL"}>
            <SelectTrigger id="status" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      {bookings.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {bookings.map((booking) => (
            <li key={booking.id}>
              <Link
                href={`/admin/bookings/${booking.id}`}
                className="flex flex-wrap items-center justify-between gap-4 p-4 text-sm hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium">{booking.customer.name}</p>
                  <p className="text-muted-foreground">{booking.customer.email}</p>
                </div>
                <div>
                  <p>{booking.service.name}</p>
                  <p className="text-muted-foreground">
                    {booking.startDate.toLocaleDateString("en-GB")}
                    {booking.endDate.getTime() !== booking.startDate.getTime()
                      ? ` – ${booking.endDate.toLocaleDateString("en-GB")}`
                      : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatPence(booking.totalPence)}</p>
                  <Badge variant="secondary">{booking.status.replace(/_/g, " ")}</Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No bookings match those filters.</p>
      )}
    </div>
  )
}
