"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/auth"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { startOfDay, nightsBetween } from "@/lib/dates"
import { findAvailableKennelUnit, isDaycareAvailable } from "@/lib/availability"
import { computeBookingPrice } from "@/lib/booking-pricing"
import { getSetting } from "@/lib/settings"
import { resolveBookingCreation, type BookingCreationResult } from "@/app/(marketing)/book/actions"

export type AdminActionState = { status: "idle" | "error"; message?: string }

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }
  return session
}

export async function searchCustomers(query: string) {
  await requireAdmin()
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  return prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      OR: [
        { email: { contains: trimmed } },
        { name: { contains: trimmed } },
      ],
    },
    select: { id: true, name: true, email: true, phone: true },
    orderBy: { name: "asc" },
    take: 10,
  })
}

export async function getCustomerDogs(customerId: string) {
  await requireAdmin()
  return prisma.dog.findMany({
    where: { ownerId: customerId },
    select: { id: true, name: true, breed: true },
    orderBy: { name: "asc" },
  })
}

const quickCustomerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Enter a valid email address").max(200),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
})

export type QuickCustomerResult = AdminActionState & {
  customer?: { id: string; name: string; email: string; phone: string | null }
}

export async function createQuickCustomer(input: {
  name: string
  email: string
  phone?: string
}): Promise<QuickCustomerResult> {
  await requireAdmin()
  const parsed = quickCustomerSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) {
    return { status: "error", message: "A customer with that email already exists — search for them instead." }
  }

  const customer = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      role: "CUSTOMER",
    },
    select: { id: true, name: true, email: true, phone: true },
  })

  return { status: "idle", customer }
}

const quickDogSchema = z.object({
  ownerId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(100),
  breed: z.string().trim().min(1, "Breed is required").max(100),
})

export type QuickDogResult = AdminActionState & { dog?: { id: string; name: string; breed: string } }

export async function createQuickDog(input: {
  ownerId: string
  name: string
  breed: string
}): Promise<QuickDogResult> {
  await requireAdmin()
  const parsed = quickDogSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const owner = await prisma.user.findUnique({ where: { id: parsed.data.ownerId } })
  if (!owner || owner.role !== "CUSTOMER") {
    return { status: "error", message: "Customer not found." }
  }

  const dog = await prisma.dog.create({
    data: { ownerId: parsed.data.ownerId, name: parsed.data.name, breed: parsed.data.breed },
    select: { id: true, name: true, breed: true },
  })

  return { status: "idle", dog }
}

const manualBookingSchema = z.object({
  customerId: z.string().min(1),
  serviceSlug: z.string().min(1),
  dogIds: z.array(z.string()).min(1, "Select at least one dog"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  date: z.string().optional(),
  walkSlotId: z.string().optional(),
  vanRunId: z.string().optional(),
  pickupAddress: z.string().optional(),
  accessNotes: z.string().optional(),
  postcode: z.string().optional(),
})

export async function createManualBooking(
  input: z.infer<typeof manualBookingSchema>
): Promise<BookingCreationResult> {
  await requireAdmin()
  const parsed = manualBookingSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid submission." }
  }

  const result = await resolveBookingCreation(
    parsed.data.customerId,
    { ...parsed.data, addons: [] },
    { skipVaccinationGate: true }
  )
  if (result.status === "error") return result

  revalidatePath("/admin/bookings")
  redirect(`/admin/bookings/${result.bookingId}`)
}

const NON_MODIFIABLE_STATUSES = [
  "CHECKED_IN",
  "CHECKED_OUT",
  "COMPLETED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_ADMIN",
  "NO_SHOW",
]

export type ModifyDatesState = AdminActionState

export async function modifyBookingDates(
  bookingId: string,
  _prevState: ModifyDatesState,
  formData: FormData
): Promise<ModifyDatesState> {
  await requireAdmin()

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: true, bookingDogs: true },
  })
  if (!booking) return { status: "error", message: "Booking not found." }
  if (NON_MODIFIABLE_STATUSES.includes(booking.status)) {
    return { status: "error", message: "This booking's dates can no longer be changed." }
  }

  const dogCount = booking.bookingDogs.length

  if (booking.service.slug === "overnight-boarding") {
    const startDateRaw = formData.get("startDate") as string | null
    const endDateRaw = formData.get("endDate") as string | null
    if (!startDateRaw || !endDateRaw) {
      return { status: "error", message: "Select check-in and check-out dates." }
    }
    const startDate = startOfDay(new Date(startDateRaw))
    const endDate = startOfDay(new Date(endDateRaw))
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return { status: "error", message: "Enter valid dates." }
    }
    const nights = nightsBetween(startDate, endDate)
    if (nights.length === 0) {
      return { status: "error", message: "Check-out must be after check-in." }
    }
    if (nights.length > 60) {
      return { status: "error", message: "Stays longer than 60 nights aren't supported — check the dates." }
    }

    // Release this booking's own occupancy first so the availability check
    // below doesn't see its old dates as a conflict with itself. Keep a copy
    // so we can restore it if no new kennel can be secured — an admin editing
    // dates should never leave a booking silently unprotected.
    const oldKennelUnitId = booking.kennelUnitId
    const oldNights = nightsBetween(booking.startDate, booking.endDate)
    await prisma.kennelOccupancy.deleteMany({ where: { bookingId } })

    async function restoreOldOccupancy() {
      if (oldKennelUnitId && oldNights.length > 0) {
        await prisma.kennelOccupancy.createMany({
          data: oldNights.map((date) => ({ kennelUnitId: oldKennelUnitId, date, bookingId })),
        })
      }
    }

    const addonsPricePence = (
      await prisma.bookingAddon.findMany({ where: { bookingId } })
    ).reduce((sum, a) => sum + a.pricePence, 0)
    const pricing = await computeBookingPrice({
      pricingModel: booking.service.pricingModel,
      basePricePence: booking.service.basePricePence,
      units: nights.length,
      dogCount,
      addons: [],
    })
    const balanceDueDays = Number(await getSetting("balance_due_days_before_checkin", "7"))
    const balanceDueDate = new Date(startDate)
    balanceDueDate.setDate(balanceDueDate.getDate() - balanceDueDays)

    // findAvailableKennelUnit must run outside any $transaction — it uses the
    // shared prisma client, and calling it from inside a tx callback deadlocks
    // the single SQLite connection.
    let updated = false
    let noKennelAvailable = false
    try {
      const MAX_ATTEMPTS = 5
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const candidate = await findAvailableKennelUnit(startDate, endDate, dogCount)
        if (!candidate) {
          noKennelAvailable = true
          break
        }
        try {
          await prisma.$transaction(async (tx) => {
            await tx.booking.update({
              where: { id: bookingId },
              data: {
                startDate,
                endDate,
                kennelUnitId: candidate.id,
                totalPence: pricing.totalPence + addonsPricePence,
                depositPence: pricing.depositPence,
                balanceDueDate,
              },
            })
            await tx.kennelOccupancy.createMany({
              data: nights.map((date) => ({ kennelUnitId: candidate.id, date, bookingId })),
            })
          })
          updated = true
          break
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue
          throw error
        }
      }
    } catch (error) {
      await restoreOldOccupancy()
      throw error
    }
    if (noKennelAvailable) {
      await restoreOldOccupancy()
      return { status: "error", message: "No kennels are available for those dates." }
    }
    if (!updated) {
      await restoreOldOccupancy()
      return { status: "error", message: "Those dates just became fully booked. Please try again." }
    }
  } else if (booking.service.slug === "daycare") {
    const dateRaw = formData.get("date") as string | null
    if (!dateRaw) return { status: "error", message: "Select a date." }
    const date = startOfDay(new Date(dateRaw))

    const availability = await isDaycareAvailable(date)
    if (availability.remaining < dogCount) {
      return { status: "error", message: "Not enough daycare capacity on that date." }
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: { startDate: date, endDate: date },
    })
  } else {
    return { status: "error", message: "Dates for this service are changed by reassigning the slot or run." }
  }

  revalidatePath(`/admin/bookings/${bookingId}`)
  revalidatePath("/admin/bookings")
  return { status: "idle", message: "Dates updated." }
}

export type ReassignKennelResult = { status: "idle" | "error"; message?: string }

export async function reassignKennel(
  bookingId: string,
  newKennelUnitId: string
): Promise<ReassignKennelResult> {
  await requireAdmin()

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: true, bookingDogs: true },
  })
  if (!booking || booking.service.slug !== "overnight-boarding" || !booking.kennelUnitId) {
    return { status: "error", message: "This booking isn't a kennel stay." }
  }
  if (NON_MODIFIABLE_STATUSES.includes(booking.status)) {
    return { status: "error", message: "This booking can no longer be changed." }
  }
  if (newKennelUnitId === booking.kennelUnitId) {
    return { status: "idle", message: "Already assigned to that kennel." }
  }

  const newKennel = await prisma.kennelUnit.findUnique({ where: { id: newKennelUnitId } })
  const dogCount = booking.bookingDogs.length
  if (!newKennel || !newKennel.active || newKennel.dogCapacity < dogCount) {
    return { status: "error", message: "That kennel can't take this booking." }
  }

  const nights = nightsBetween(booking.startDate, booking.endDate)
  const [blocked, occupied] = await Promise.all([
    prisma.blockedDate.count({ where: { kennelUnitId: newKennelUnitId, date: { in: nights } } }),
    prisma.kennelOccupancy.count({
      where: { kennelUnitId: newKennelUnitId, date: { in: nights }, bookingId: { not: bookingId } },
    }),
  ])
  if (blocked > 0 || occupied > 0) {
    return { status: "error", message: "That kennel isn't free for these dates." }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.kennelOccupancy.deleteMany({ where: { bookingId } })
      await tx.booking.update({ where: { id: bookingId }, data: { kennelUnitId: newKennelUnitId } })
      await tx.kennelOccupancy.createMany({
        data: nights.map((date) => ({ kennelUnitId: newKennelUnitId, date, bookingId })),
      })
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { status: "error", message: "That kennel was just taken for these dates. Please try again." }
    }
    throw error
  }

  revalidatePath(`/admin/bookings/${bookingId}`)
  revalidatePath("/admin/bookings")
  revalidatePath("/admin/occupancy")
  return { status: "idle", message: `Moved to ${newKennel.name}.` }
}

export type CancelBookingAdminResult = { status: "success"; message: string } | { status: "error"; message: string }

async function refundPayment(
  bookingId: string,
  payment: { id: string; stripePaymentIntentId: string | null; amountPence: number }
) {
  if (!stripe || !payment.stripePaymentIntentId) return false
  try {
    await stripe.refunds.create({ payment_intent: payment.stripePaymentIntentId })
    await prisma.$transaction([
      prisma.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } }),
      prisma.payment.create({
        data: { bookingId, type: "REFUND", amountPence: payment.amountPence, status: "SUCCEEDED" },
      }),
    ])
    return true
  } catch (error) {
    console.error(`[cancelBookingAdmin] failed to refund payment ${payment.id}`, error)
    return false
  }
}

export async function cancelBookingAdmin(
  bookingId: string,
  reason: string
): Promise<CancelBookingAdminResult> {
  await requireAdmin()

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payments: true },
  })
  if (!booking) return { status: "error", message: "Booking not found." }
  if (NON_MODIFIABLE_STATUSES.includes(booking.status)) {
    return { status: "error", message: "This booking can no longer be cancelled." }
  }

  const successfulPayments = booking.payments.filter(
    (p) => (p.type === "DEPOSIT" || p.type === "BALANCE") && p.status === "SUCCEEDED"
  )
  let refundedPence = 0
  for (const payment of successfulPayments) {
    if (await refundPayment(booking.id, payment)) refundedPence += payment.amountPence
  }

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "CANCELLED_BY_ADMIN",
        cancellationReason: reason.trim() || "Cancelled by admin",
      },
    }),
    prisma.kennelOccupancy.deleteMany({ where: { bookingId } }),
    prisma.walkBooking.deleteMany({ where: { bookingId } }),
    prisma.vanRunStop.deleteMany({ where: { bookingId } }),
  ])

  revalidatePath(`/admin/bookings/${bookingId}`)
  revalidatePath("/admin/bookings")

  return {
    status: "success",
    message:
      refundedPence > 0
        ? `Cancelled — refunded ${(refundedPence / 100).toLocaleString("en-GB", { style: "currency", currency: "GBP" })}.`
        : "Cancelled.",
  }
}
