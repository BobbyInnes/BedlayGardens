"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { nightsBetween } from "@/lib/dates"
import { checkVaccinationGate } from "@/lib/vaccination-gate"
import { createBookingInvoice } from "@/lib/invoicing"
import { logAudit } from "@/lib/audit"

export type StaffActionState = { status: "idle" | "error"; message?: string }

async function requireStaff() {
  const session = await auth()
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "ADMIN")) {
    throw new Error("Unauthorized")
  }
  return session
}

export async function checkInBooking(
  bookingId: string,
  _prevState: StaffActionState,
  formData: FormData
): Promise<StaffActionState> {
  const session = await requireStaff()

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { bookingDogs: true },
  })
  if (!booking) return { status: "error", message: "Booking not found." }

  const belongingsConfirmed = formData.get("belongingsConfirmed") === "on"
  if (!belongingsConfirmed) {
    return { status: "error", message: "Confirm belongings before checking in." }
  }

  const overrideReason = (formData.get("overrideReason") as string | null)?.trim()
  const dogIds = booking.bookingDogs.map((bd) => bd.dogId)
  const gate = await checkVaccinationGate(dogIds, booking.endDate)

  if (!gate.ok && !overrideReason) {
    return {
      status: "error",
      message:
        "Vaccinations are missing or expired. Enter an override reason to check in anyway, or ask the owner to update records.",
    }
  }

  const kennelUnitId = (formData.get("kennelUnitId") as string | null) || null
  if (kennelUnitId && kennelUnitId !== booking.kennelUnitId) {
    const nights = nightsBetween(booking.startDate, booking.endDate)
    try {
      await prisma.$transaction([
        prisma.kennelOccupancy.deleteMany({ where: { bookingId } }),
        prisma.kennelOccupancy.createMany({
          data: nights.map((date) => ({ kennelUnitId, date, bookingId })),
        }),
        prisma.booking.update({ where: { id: bookingId }, data: { kennelUnitId } }),
      ])
    } catch {
      return { status: "error", message: "That accommodation isn't free for these dates." }
    }
  }

  await prisma.booking.update({ where: { id: bookingId }, data: { status: "CHECKED_IN" } })

  if (!gate.ok && overrideReason) {
    await logAudit({
      actorId: session.user.id,
      action: "CHECK_IN_VACCINATION_OVERRIDE",
      entity: "Booking",
      entityId: bookingId,
      meta: JSON.stringify({ reason: overrideReason, missing: gate.perDog }),
    })
  }

  revalidatePath("/staff")
  redirect("/staff")
}

export async function checkOutBooking(
  bookingId: string,
  _prevState: StaffActionState,
  _formData: FormData
): Promise<StaffActionState> {
  await requireStaff()

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payments: true, service: true },
  })
  if (!booking) return { status: "error", message: "Booking not found." }

  const paidPence = booking.payments
    .filter((p) => (p.type === "DEPOSIT" || p.type === "BALANCE") && p.status === "SUCCEEDED")
    .reduce((sum, p) => sum + p.amountPence, 0)
  const outstandingPence = booking.totalPence - paidPence

  // Invoice-after services are expected to have an outstanding balance at
  // check-out — that's when the invoice is raised. Everything else must be
  // settled before the dog leaves.
  if (outstandingPence > 0 && booking.service.paymentTiming !== "INVOICE_AFTER") {
    return {
      status: "error",
      message: `Balance outstanding: £${(outstandingPence / 100).toFixed(2)} — cannot check out until paid.`,
    }
  }

  await prisma.booking.update({ where: { id: bookingId }, data: { status: "CHECKED_OUT" } })

  if (booking.service.paymentTiming === "INVOICE_AFTER") {
    // Invoice failure must not block the check-out itself — admins can
    // re-issue from the booking page (createBookingInvoice is idempotent).
    try {
      await createBookingInvoice(bookingId)
    } catch (error) {
      console.error(`[checkOut] failed to create invoice for booking ${bookingId}`, error)
    }
  }

  revalidatePath("/staff")
  redirect("/staff")
}
