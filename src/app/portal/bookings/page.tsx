import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { formatPence } from "@/lib/format"

export const metadata: Metadata = {
  title: "Bookings",
}

export default async function PortalBookingsPage() {
  const session = await auth()
  const bookings = await prisma.booking.findMany({
    where: { customerId: session!.user.id },
    orderBy: { startDate: "desc" },
    include: { service: true },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
        <Button size="sm" asChild>
          <Link href="/book">Book a stay</Link>
        </Button>
      </div>

      {bookings.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {bookings.map((booking) => (
            <li key={booking.id} className="flex items-center justify-between gap-4 p-4 text-sm">
              <div>
                <p className="font-medium">{booking.service.name}</p>
                <p className="text-muted-foreground">
                  {booking.startDate.toLocaleDateString("en-GB")} –{" "}
                  {booking.endDate.toLocaleDateString("en-GB")}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatPence(booking.totalPence)}</p>
                <p className="text-muted-foreground capitalize">
                  {booking.status.toLowerCase().replace(/_/g, " ")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          You don&rsquo;t have any bookings yet. Online booking is coming soon — in the
          meantime, get in touch to arrange a stay.
        </p>
      )}
    </div>
  )
}
