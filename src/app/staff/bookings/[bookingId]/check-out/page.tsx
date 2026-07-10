import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { formatPence } from "@/lib/format"
import { CheckOutForm } from "@/components/staff/check-out-form"

export const metadata: Metadata = {
  title: "Check Out | Staff",
}

export default async function StaffCheckOutPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const { bookingId } = await params

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      service: true,
      bookingDogs: { include: { dog: true } },
      payments: true,
    },
  })
  if (!booking) notFound()

  const paidPence = booking.payments
    .filter((p) => (p.type === "DEPOSIT" || p.type === "BALANCE") && p.status === "SUCCEEDED")
    .reduce((sum, p) => sum + p.amountPence, 0)
  const outstandingPence = booking.totalPence - paidPence

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Check out — {booking.bookingDogs.map((bd) => bd.dog.name).join(", ")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {booking.customer.name} — {booking.service.name}
        </p>
      </div>

      <div className="max-w-sm space-y-2 rounded-lg border border-border p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total</span>
          <span>{formatPence(booking.totalPence)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Paid</span>
          <span>{formatPence(paidPence)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-2 font-medium">
          <span>Outstanding</span>
          <span className={outstandingPence > 0 ? "text-destructive" : "text-primary"}>
            {formatPence(outstandingPence)}
          </span>
        </div>
      </div>

      <CheckOutForm bookingId={booking.id} />
    </div>
  )
}
