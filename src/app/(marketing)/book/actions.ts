"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { nightsBetween, startOfDay } from "@/lib/dates"
import { findAvailableKennelUnit, isDaycareAvailable, isMeetGreetAvailable } from "@/lib/availability"
import { checkVaccinationGate } from "@/lib/vaccination-gate"
import { computeBookingPrice } from "@/lib/booking-pricing"
import { paymentFieldsFor } from "@/lib/payment-timing"
import { getSetting, getSettings } from "@/lib/settings"
import { sendEmail } from "@/lib/email"
import { bookingConfirmationEmail } from "@/lib/email-templates"
import { logAudit } from "@/lib/audit"
import { GROUP_BLOCKING_FLAGS, SHARED_KENNEL_BLOCKING_FLAG, DOG_FLAG_LABELS } from "@/lib/dog-flags"
import { hasCurrentSignedAgreement } from "@/lib/agreement"
import { checkTrialGate } from "@/lib/trial"
import { getApplicablePriceRules, minNightsRequired } from "@/lib/price-rules"

const addonInputSchema = z.object({ addonId: z.string(), quantity: z.number().int().min(1).max(20) })

const baseSchema = z.object({
  serviceSlug: z.string().min(1),
  dogIds: z.array(z.string()).min(1, "Select at least one dog"),
  addons: z.array(addonInputSchema).default([]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  date: z.string().optional(),
  walkSlotId: z.string().optional(),
  vanRunId: z.string().optional(),
  pickupAddress: z.string().optional(),
  accessNotes: z.string().optional(),
  postcode: z.string().optional(),
})

export type BookingActionState = {
  status: "idle" | "error"
  message?: string
  missingVaccinations?: { dogName: string; missingTypes: string[] }[]
  compatibilityBlocked?: boolean
  requiresAgreement?: boolean
  requiresTrialVisit?: boolean
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

export type BookingCreationResult = BookingActionState & { bookingId?: string }

export async function resolveBookingCreation(
  customerId: string,
  input: z.infer<typeof baseSchema>,
  options?: {
    skipVaccinationGate?: boolean
    overrideCompatibilityFlags?: boolean
    overriddenByUserId?: string
  }
): Promise<BookingCreationResult> {
  const skipVaccinationGate = options?.skipVaccinationGate ?? false
  const overrideCompatibilityFlags = options?.overrideCompatibilityFlags ?? false
  const parsed = baseSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid submission." }
  }
  const data = parsed.data

  const service = await prisma.service.findUnique({ where: { slug: data.serviceSlug } })
  if (!service || !service.active) {
    return { status: "error", message: "Service not found." }
  }

  const dogs = await prisma.dog.findMany({
    where: { id: { in: data.dogIds } },
    include: { flags: true },
  })
  if (dogs.length !== data.dogIds.length || dogs.some((dog) => dog.ownerId !== customerId)) {
    return { status: "error", message: "One or more dogs could not be found." }
  }

  if (!(await hasCurrentSignedAgreement(customerId))) {
    return {
      status: "error",
      message: "Please read and sign our current boarding agreement before booking.",
      requiresAgreement: true,
    }
  }

  if (service.requiresTrial) {
    const missingTrial = await checkTrialGate(service.id, data.dogIds)
    if (missingTrial.length > 0) {
      return {
        status: "error",
        requiresTrialVisit: true,
        message: `${missingTrial.join(", ")} ${missingTrial.length === 1 ? "requires" : "require"} a mandatory Meet & Greet evaluation before ${missingTrial.length === 1 ? "it" : "they"} can book any service.`,
      }
    }
  }

  if (!overrideCompatibilityFlags) {
    if (dogs.length > 1) {
      const noSharedKennelDog = dogs.find((dog) =>
        dog.flags.some((f) => f.type === SHARED_KENNEL_BLOCKING_FLAG)
      )
      if (noSharedKennelDog) {
        return {
          status: "error",
          compatibilityBlocked: true,
          message: `${noSharedKennelDog.name} is flagged "${DOG_FLAG_LABELS[SHARED_KENNEL_BLOCKING_FLAG]}" and can't be booked into accommodation with another dog. Book separately.`,
        }
      }
    }
    if (["secure-forest-walks", "dog-walking"].includes(service.slug)) {
      const flaggedDog = dogs.find((dog) =>
        dog.flags.some((f) => GROUP_BLOCKING_FLAGS.includes(f.type))
      )
      if (flaggedDog) {
        const flagType = flaggedDog.flags.find((f) => GROUP_BLOCKING_FLAGS.includes(f.type))!.type
        return {
          status: "error",
          compatibilityBlocked: true,
          message: `${flaggedDog.name} is flagged "${DOG_FLAG_LABELS[flagType]}" and can't join a group session. Please get in touch to arrange this.`,
        }
      }
    }
  } else if (options?.overriddenByUserId) {
    const flaggedDogIds = dogs.filter((d) => d.flags.length > 0).map((d) => d.id)
    for (const dogId of flaggedDogIds) {
      await logAudit({
        actorId: options.overriddenByUserId,
        action: "OVERRIDE_DOG_COMPATIBILITY_FLAG",
        entity: "Dog",
        entityId: dogId,
        meta: `service=${service.slug}`,
      })
    }
  }

  const addonRecords =
    data.addons.length > 0
      ? await prisma.addon.findMany({ where: { id: { in: data.addons.map((a) => a.addonId) } } })
      : []

  let bookingId: string | null = null

  if (service.slug === "overnight-boarding") {
    if (!data.startDate || !data.endDate) {
      return { status: "error", message: "Select check-in and check-out dates." }
    }
    const startDate = startOfDay(new Date(data.startDate))
    const endDate = startOfDay(new Date(data.endDate))
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

    const gate = skipVaccinationGate ? { ok: true, perDog: [] } : await checkVaccinationGate(data.dogIds, endDate)
    if (!gate.ok) {
      return {
        status: "error",
        message: "Vaccinations are missing or expired for this stay.",
        missingVaccinations: gate.perDog
          .filter((d) => d.missingTypes.length > 0)
          .map((d) => ({ dogName: d.dogName, missingTypes: d.missingTypes })),
      }
    }

    const peakRules = await getApplicablePriceRules(service.id, nights)
    const minStay = minNightsRequired(nights, peakRules)
    if (minStay && nights.length < minStay.minNights) {
      return {
        status: "error",
        message: `${minStay.label} requires a minimum stay of ${minStay.minNights} nights.`,
      }
    }

    const pricing = await computeBookingPrice({
      serviceId: service.id,
      pricingModel: service.pricingModel,
      basePricePence: service.basePricePence,
      dates: nights,
      dogCount: dogs.length,
      addons: addonRecords.map((addon) => ({
        pricePence: addon.pricePence,
        quantity: data.addons.find((a) => a.addonId === addon.id)?.quantity ?? 1,
      })),
    })

    const balanceDueDays = Number(await getSetting("balance_due_days_before_checkin", "7"))
    const balanceDueDate = new Date(startDate)
    balanceDueDate.setDate(balanceDueDate.getDate() - balanceDueDays)
    const paymentFields = paymentFieldsFor(service.paymentTiming, pricing)

    const MAX_ATTEMPTS = 5
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const candidate = await findAvailableKennelUnit(startDate, endDate, dogs.length)
      if (!candidate) {
        return { status: "error", message: "No accommodation is available for these dates." }
      }

      try {
        const booking = await prisma.$transaction(async (tx) => {
          const created = await tx.booking.create({
            data: {
              customerId,
              serviceId: service.id,
              startDate,
              endDate,
              status: paymentFields.status,
              kennelUnitId: candidate.id,
              totalPence: pricing.totalPence,
              depositPence: paymentFields.depositPence,
              balanceDueDate: service.paymentTiming === "DEPOSIT_THEN_BALANCE" ? balanceDueDate : null,
            },
          })
          await tx.kennelOccupancy.createMany({
            data: nights.map((date) => ({ kennelUnitId: candidate.id, date, bookingId: created.id })),
          })
          await tx.bookingDog.createMany({
            data: data.dogIds.map((dogId) => ({ bookingId: created.id, dogId })),
          })
          if (data.addons.length > 0) {
            await tx.bookingAddon.createMany({
              data: data.addons.map((a) => {
                const addon = addonRecords.find((record) => record.id === a.addonId)!
                return {
                  bookingId: created.id,
                  addonId: a.addonId,
                  quantity: a.quantity,
                  pricePence: addon.pricePence * a.quantity,
                }
              }),
            })
          }
          return created
        })
        bookingId = booking.id
        break
      } catch (error) {
        if (isUniqueConstraintError(error)) continue
        throw error
      }
    }

    if (!bookingId) {
      return { status: "error", message: "Those dates just became fully booked. Please try again." }
    }
  } else if (service.slug === "daycare") {
    if (!data.date) return { status: "error", message: "Select a date." }
    const date = startOfDay(new Date(data.date))

    const gate = skipVaccinationGate ? { ok: true, perDog: [] } : await checkVaccinationGate(data.dogIds, date)
    if (!gate.ok) {
      return {
        status: "error",
        message: "Vaccinations are missing or expired.",
        missingVaccinations: gate.perDog
          .filter((d) => d.missingTypes.length > 0)
          .map((d) => ({ dogName: d.dogName, missingTypes: d.missingTypes })),
      }
    }

    const availability = await isDaycareAvailable(date)
    if (availability.remaining < dogs.length) {
      return { status: "error", message: availability.reason ?? "Not enough daycare capacity on that date." }
    }

    const pricing = await computeBookingPrice({
      serviceId: service.id,
      pricingModel: service.pricingModel,
      basePricePence: service.basePricePence,
      dates: [date],
      dogCount: dogs.length,
      addons: [],
    })

    const booking = await prisma.$transaction(async (tx) => {
      const recheckCount = await tx.bookingDog.count({
        where: {
          booking: {
            startDate: date,
            service: { slug: "daycare" },
            status: { notIn: ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_ADMIN", "NO_SHOW"] },
          },
        },
      })
      const capacity = Number(await getSetting("daycare_max_capacity", "0"))
      if (recheckCount + dogs.length > capacity) {
        throw new Error("DAYCARE_FULL")
      }
      const created = await tx.booking.create({
        data: {
          customerId,
          serviceId: service.id,
          startDate: date,
          endDate: date,
          ...paymentFieldsFor(service.paymentTiming, pricing),
          totalPence: pricing.totalPence,
        },
      })
      await tx.bookingDog.createMany({
        data: data.dogIds.map((dogId) => ({ bookingId: created.id, dogId })),
      })
      return created
    }).catch((error) => {
      if (error instanceof Error && error.message === "DAYCARE_FULL") return null
      throw error
    })

    if (!booking) {
      return { status: "error", message: "That date just filled up. Please try another date." }
    }
    bookingId = booking.id
  } else if (service.slug === "secure-forest-walks") {
    if (!data.walkSlotId) return { status: "error", message: "Select a walk slot." }
    const slot = await prisma.walkSlot.findUnique({
      where: { id: data.walkSlotId },
      include: { walkBookings: true },
    })
    if (!slot) return { status: "error", message: "Walk slot not found." }

    const gate = skipVaccinationGate ? { ok: true, perDog: [] } : await checkVaccinationGate(data.dogIds, slot.date)
    if (!gate.ok) {
      return {
        status: "error",
        message: "Vaccinations are missing or expired.",
        missingVaccinations: gate.perDog
          .filter((d) => d.missingTypes.length > 0)
          .map((d) => ({ dogName: d.dogName, missingTypes: d.missingTypes })),
      }
    }

    const pricing = await computeBookingPrice({
      serviceId: service.id,
      pricingModel: service.pricingModel,
      basePricePence: service.basePricePence,
      dates: [slot.date],
      dogCount: dogs.length,
      addons: [],
    })

    const booking = await prisma.$transaction(async (tx) => {
      const current = await tx.walkSlot.findUnique({
        where: { id: data.walkSlotId },
        include: { walkBookings: true },
      })
      if (!current || current.maxDogs - current.walkBookings.length < dogs.length) {
        throw new Error("SLOT_FULL")
      }
      const created = await tx.booking.create({
        data: {
          customerId,
          serviceId: service.id,
          startDate: current.date,
          endDate: current.date,
          ...paymentFieldsFor(service.paymentTiming, pricing),
          totalPence: pricing.totalPence,
        },
      })
      await tx.bookingDog.createMany({
        data: data.dogIds.map((dogId) => ({ bookingId: created.id, dogId })),
      })
      await tx.walkBooking.createMany({
        data: data.dogIds.map((dogId) => ({
          walkSlotId: data.walkSlotId!,
          bookingId: created.id,
          dogId,
        })),
      })
      return created
    }).catch((error) => {
      if (error instanceof Error && error.message === "SLOT_FULL") return null
      throw error
    })

    if (!booking) {
      return { status: "error", message: "That slot just filled up. Please choose another." }
    }
    bookingId = booking.id
  } else if (service.slug === "dog-walking") {
    if (!data.vanRunId || !data.pickupAddress) {
      return { status: "error", message: "Select a van run and enter a pickup address." }
    }
    const postcodesRaw = await getSetting("dog_walking_service_postcodes", "")
    const allowedPostcodes = postcodesRaw
      .split(",")
      .map((p) => p.trim().toUpperCase())
      .filter(Boolean)
    const outwardCode = (data.postcode ?? "").trim().toUpperCase().split(" ")[0]
    if (allowedPostcodes.length > 0 && !allowedPostcodes.includes(outwardCode)) {
      return {
        status: "error",
        message:
          "Sorry, that address is outside our dog walking service area. Please get in touch and we'll see what we can do.",
      }
    }

    const run = await prisma.vanRun.findUnique({ where: { id: data.vanRunId } })
    if (!run) return { status: "error", message: "Van run not found." }

    const gate = skipVaccinationGate ? { ok: true, perDog: [] } : await checkVaccinationGate(data.dogIds, run.date)
    if (!gate.ok) {
      return {
        status: "error",
        message: "Vaccinations are missing or expired.",
        missingVaccinations: gate.perDog
          .filter((d) => d.missingTypes.length > 0)
          .map((d) => ({ dogName: d.dogName, missingTypes: d.missingTypes })),
      }
    }

    const pricing = await computeBookingPrice({
      serviceId: service.id,
      pricingModel: service.pricingModel,
      basePricePence: service.basePricePence,
      dates: [run.date],
      dogCount: dogs.length,
      addons: [],
    })

    const booking = await prisma.$transaction(async (tx) => {
      const current = await tx.vanRun.findUnique({ where: { id: data.vanRunId }, include: { stops: true } })
      if (!current || current.maxDogs - current.stops.length < dogs.length) {
        throw new Error("RUN_FULL")
      }
      const created = await tx.booking.create({
        data: {
          customerId,
          serviceId: service.id,
          startDate: current.date,
          endDate: current.date,
          ...paymentFieldsFor(service.paymentTiming, pricing),
          totalPence: pricing.totalPence,
        },
      })
      await tx.bookingDog.createMany({
        data: data.dogIds.map((dogId) => ({ bookingId: created.id, dogId })),
      })
      await tx.vanRunStop.createMany({
        data: data.dogIds.map((dogId, index) => ({
          vanRunId: data.vanRunId!,
          bookingId: created.id,
          dogId,
          pickupAddress: data.pickupAddress!,
          accessNotes: data.accessNotes || null,
          sortOrder: current.stops.length + index,
        })),
      })
      return created
    }).catch((error) => {
      if (error instanceof Error && error.message === "RUN_FULL") return null
      throw error
    })

    if (!booking) {
      return { status: "error", message: "That run just filled up. Please choose another." }
    }
    bookingId = booking.id
  } else if (service.slug === "meet-greet") {
    if (!data.date) return { status: "error", message: "Select a date." }
    const date = startOfDay(new Date(data.date))

    const availability = await isMeetGreetAvailable(date)
    if (availability.remaining < dogs.length) {
      return { status: "error", message: availability.reason ?? "Not enough meet & greet capacity on that date." }
    }

    const pricing = await computeBookingPrice({
      serviceId: service.id,
      pricingModel: service.pricingModel,
      basePricePence: service.basePricePence,
      dates: [date],
      dogCount: dogs.length,
      addons: [],
    })

    const booking = await prisma.$transaction(async (tx) => {
      const recheckCount = await tx.bookingDog.count({
        where: {
          booking: {
            startDate: date,
            service: { slug: "meet-greet" },
            status: { notIn: ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_ADMIN", "NO_SHOW"] },
          },
        },
      })
      const capacity = Number(await getSetting("meet_greet_max_capacity", "0"))
      if (recheckCount + dogs.length > capacity) {
        throw new Error("MEET_GREET_FULL")
      }
      const created = await tx.booking.create({
        data: {
          customerId,
          serviceId: service.id,
          startDate: date,
          endDate: date,
          ...paymentFieldsFor(service.paymentTiming, pricing),
          totalPence: pricing.totalPence,
        },
      })
      await tx.bookingDog.createMany({
        data: data.dogIds.map((dogId) => ({ bookingId: created.id, dogId })),
      })
      await tx.trialVisit.createMany({
        data: data.dogIds.map((dogId) => ({ bookingId: created.id, dogId })),
      })
      return created
    }).catch((error) => {
      if (error instanceof Error && error.message === "MEET_GREET_FULL") return null
      throw error
    })

    if (!booking) {
      return { status: "error", message: "That date just filled up. Please try another date." }
    }
    bookingId = booking.id
  } else {
    return { status: "error", message: "Booking isn't available for this service yet." }
  }

  // INVOICE_AFTER bookings are confirmed immediately and never reach the
  // payment webhook that sends the confirmation email for paid bookings, so
  // send it at creation. A failed email must not fail the booking itself.
  if (service.paymentTiming === "INVOICE_AFTER") {
    try {
      const [settings, customer, booking] = await Promise.all([
        getSettings(),
        prisma.user.findUniqueOrThrow({ where: { id: customerId } }),
        prisma.booking.findUniqueOrThrow({ where: { id: bookingId! } }),
      ])
      const confirmation = bookingConfirmationEmail(settings, {
        serviceName: service.name,
        startDate: booking.startDate,
        endDate: booking.endDate,
        totalPence: booking.totalPence,
        depositPence: booking.depositPence,
      })
      await sendEmail({ to: customer.email, subject: confirmation.subject, html: confirmation.html })
    } catch (error) {
      console.error("[booking] failed to send invoice-after confirmation email", error)
    }
  }

  return { status: "idle", bookingId: bookingId! }
}

export async function createBooking(
  input: z.infer<typeof baseSchema>
): Promise<BookingActionState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Please log in to book." }

  const result = await resolveBookingCreation(session.user.id, input)
  if (result.status === "error") return result

  revalidatePath("/portal/bookings")
  redirect(`/book/confirmation/${result.bookingId}`)
}
