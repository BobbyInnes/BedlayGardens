"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getSetting } from "@/lib/settings"

export type CancelBookingResult = { status: "success"; message: string } | { status: "error"; message: string }

const NON_CANCELLABLE_STATUSES = [
  "CHECKED_IN",
  "CHECKED_OUT",
  "COMPLETED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_ADMIN",
  "NO_SHOW",
]

export async function cancelBooking(bookingId: string): Promise<CancelBookingResult> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Unauthorized" }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
  if (!booking || booking.customerId !== session.user.id) {
    return { status: "error", message: "Booking not found." }
  }
  if (NON_CANCELLABLE_STATUSES.includes(booking.status)) {
    return { status: "error", message: "This booking can no longer be cancelled." }
  }

  const freeDays = Number(await getSetting("cancellation_free_days", "14"))
  const noRefundHours = Number(await getSetting("cancellation_no_refund_hours", "48"))
  const hoursUntilStart = (booking.startDate.getTime() - Date.now()) / (1000 * 60 * 60)

  let policyNote: string
  if (hoursUntilStart >= freeDays * 24) {
    policyNote = "Cancelled — this falls outside the free cancellation window, so a full refund applies once payments are enabled."
  } else if (hoursUntilStart >= noRefundHours) {
    policyNote = "Cancelled — per our policy the deposit is forfeit for cancellations within the free window."
  } else {
    policyNote = "Cancelled — per our policy no refund applies this close to the stay."
  }

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED_BY_CUSTOMER", cancellationReason: "Cancelled by customer" },
    }),
    prisma.kennelOccupancy.deleteMany({ where: { bookingId } }),
    prisma.walkBooking.deleteMany({ where: { bookingId } }),
    prisma.vanRunStop.deleteMany({ where: { bookingId } }),
  ])

  revalidatePath("/portal/bookings")
  return { status: "success", message: policyNote }
}
