"use server"

import { randomUUID } from "node:crypto"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma, type PaymentTiming } from "@/generated/prisma/client"
import { isDriverAdapterError } from "@prisma/driver-adapter-utils"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { nightsBetween, startOfDay, isPastDaycareHalfDayAmCutoff } from "@/lib/dates"
import { findAvailableKennelUnit, isDaycareAvailable, isMeetGreetAvailable } from "@/lib/availability"
import { checkVaccinationGate } from "@/lib/vaccination-gate"
import { computeBookingPrice } from "@/lib/booking-pricing"
import { paymentFieldsForGate } from "@/lib/payment-timing"
import { getSetting, getSettings } from "@/lib/settings"
import { getVatSettings } from "@/lib/vat"
import { sendEmail } from "@/lib/email"
import { getSiteUrl } from "@/lib/stripe"
import {
  bookingConfirmationEmail,
  bookingConfirmationDepositInvoiceEmail,
  pendingVaccinationEmail,
} from "@/lib/email-templates"
import { logAudit } from "@/lib/audit"
import { fullName } from "@/lib/format"
import { GROUP_BLOCKING_FLAGS, SHARED_KENNEL_BLOCKING_FLAGS, DOG_FLAG_LABELS } from "@/lib/dog-flags"
import { largestDogSize } from "@/lib/dog-size-colors"
import { hasCurrentSignedAgreement } from "@/lib/agreement"
import { checkTrialGate } from "@/lib/trial"
import { getApplicablePriceRules, minNightsRequired } from "@/lib/price-rules"
import {
  findDogBookingConflicts,
  formatDogBookingConflictMessage,
  formatDogBookingConflicts,
  type DogBookingConflictEntry,
} from "@/lib/booking-conflicts"

const addonInputSchema = z.object({ addonId: z.string(), quantity: z.number().int().min(1).max(20) })

const baseSchema = z.object({
  serviceSlug: z.string().min(1),
  dogIds: z.array(z.string()).min(1, "Select at least one dog"),
  addons: z.array(addonInputSchema).default([]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  date: z.string().optional(),
  daycareDuration: z.enum(["FULL_DAY", "HALF_DAY"]).optional(),
  daycareHalfDaySlot: z.enum(["AM", "PM"]).optional(),
  walkSlotId: z.string().optional(),
  vanRunId: z.string().optional(),
  pickupAddress: z.string().optional(),
  accessNotes: z.string().optional(),
  postcode: z.string().optional(),
  // Set on resubmission after the customer is warned their dog(s) have no
  // currently-valid vaccine certificate and chooses to book anyway. The
  // booking still gets created (and, where applicable, still charges a
  // deposit) — see resolveBookingStatusForGate — rather than being blocked
  // outright.
  proceedWithoutValidVaccines: z.boolean().optional(),
})

export type BookingActionState = {
  status: "idle" | "error"
  message?: string
  missingVaccinations?: { dogName: string; missingTypes: string[] }[]
  // Set alongside missingVaccinations when the customer can choose to
  // proceed anyway (resubmit with proceedWithoutValidVaccines: true) rather
  // than the booking being a dead end.
  canWatchlist?: boolean
  compatibilityBlocked?: boolean
  requiresAgreement?: boolean
  requiresTrialVisit?: boolean
  duplicateServiceBooking?: DogBookingConflictEntry[]
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

// P2034: Postgres aborted the transaction for a write conflict — the outcome
// of a "SERIALIZABLE" transaction that raced another one over the same rows.
// With the driver-adapter architecture (@prisma/adapter-neon) this doesn't
// get wrapped into a PrismaClientKnownRequestError at all — it surfaces as
// DriverAdapterError with cause.kind "TransactionWriteConflict" for the same
// underlying Postgres SQLSTATE 40001, so both shapes need checking or this
// retry loop silently never fires and the raw error reaches the customer as
// an application error instead of a clean "just filled up" message.
function isSerializationError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return true
  if (isDriverAdapterError(error) && error.cause.kind === "TransactionWriteConflict") return true
  return false
}

// Day care and meet & greet capacity are both enforced by counting existing
// bookings for the day, then inserting, inside one transaction — a plain
// "read count, then write" check like that is exactly the write-skew race
// Postgres's default READ COMMITTED isolation does not prevent: two
// concurrent bookings can each read the count as under capacity and both
// commit, going over. SERIALIZABLE isolation makes Postgres detect that and
// abort one side (surfaced by Prisma as P2034) rather than let it happen —
// retried here a few times before giving up, same shape as the kennel
// booking retry loop below for unique-constraint races.
async function runCapacityCheckedTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T | undefined> {
  const MAX_ATTEMPTS = 5
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
    } catch (error) {
      if (isSerializationError(error)) continue
      throw error
    }
  }
  return undefined
}

// Balance is only auto-charged/reminded for DEPOSIT_THEN_BALANCE services —
// null here means the charge-balances and send-reminders crons skip the
// booking entirely, so every creation branch below must set this.
async function balanceDueDateFor(paymentTiming: PaymentTiming, referenceDate: Date): Promise<Date | null> {
  if (paymentTiming !== "DEPOSIT_THEN_BALANCE") return null
  const balanceDueDays = Number(await getSetting("balance_due_days_before_checkin", "7"))
  const dueDate = new Date(referenceDate)
  dueDate.setDate(dueDate.getDate() - balanceDueDays)
  return dueDate
}

export type BookingCreationResult = BookingActionState & { bookingId?: string }

async function checkForDuplicateServiceBooking(
  dogIds: string[],
  startDate: Date,
  endDate: Date
): Promise<BookingActionState | null> {
  const conflicts = await findDogBookingConflicts(dogIds, startDate, endDate)
  if (conflicts.length === 0) return null
  return {
    status: "error",
    message: formatDogBookingConflictMessage(conflicts),
    duplicateServiceBooking: formatDogBookingConflicts(conflicts),
  }
}

export async function resolveBookingCreation(
  customerId: string,
  input: z.infer<typeof baseSchema>,
  options?: {
    skipVaccinationGate?: boolean
    overrideCompatibilityFlags?: boolean
    overriddenByUserId?: string
    actorId?: string
    // Day care multi-date booking only — links this booking to the others
    // created in the same batch, and (since siblings may not exist in the DB
    // yet while the batch is still being created) the other requested dates
    // so an immediate confirmation email can mention them right away.
    batchId?: string
    otherDaycareDates?: string[]
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
      message: "Please read and sign Our Terms and Conditions before booking.",
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
        dog.flags.some((f) => SHARED_KENNEL_BLOCKING_FLAGS.includes(f.type))
      )
      if (noSharedKennelDog) {
        const flagType = noSharedKennelDog.flags.find((f) =>
          SHARED_KENNEL_BLOCKING_FLAGS.includes(f.type)
        )!.type
        return {
          status: "error",
          compatibilityBlocked: true,
          message: `${noSharedKennelDog.name} is flagged "${DOG_FLAG_LABELS[flagType]}" and can't be booked into accommodation with another dog. Book separately.`,
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
  // Set true only if skipVaccinationGate (admin's explicit override) was
  // actually needed — i.e. the gate really did fail — not just present but
  // moot on an already-compliant booking. Audited once, after bookingId is
  // known, alongside the existing OVERRIDE_DOG_COMPATIBILITY_FLAG entries.
  let vaccinationGateOverridden = false

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

    const duplicateConflict = await checkForDuplicateServiceBooking(data.dogIds, startDate, endDate)
    if (duplicateConflict) return duplicateConflict

    // skipVaccinationGate (admin's explicit override — see createManualBooking)
    // still runs the real check, unlike before, so a genuine override gets
    // audited below rather than silently never checking at all; it just
    // isn't allowed to block creation or affect the resulting status.
    const gate = await checkVaccinationGate(data.dogIds, endDate)
    const statusGateOk = gate.ok || skipVaccinationGate
    if (skipVaccinationGate && !gate.ok) vaccinationGateOverridden = true
    if (!statusGateOk && !data.proceedWithoutValidVaccines) {
      return {
        status: "error",
        message: "Vaccinations are missing or expired for this stay.",
        missingVaccinations: gate.perDog
          .filter((d) => d.missingTypes.length > 0)
          .map((d) => ({ dogName: d.dogName, missingTypes: d.missingTypes })),
        canWatchlist: true,
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

    const balanceDueDate = await balanceDueDateFor(service.paymentTiming, startDate)
    const paymentFields = paymentFieldsForGate(service.paymentTiming, pricing, statusGateOk)

    const MAX_ATTEMPTS = 5
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const candidate = await findAvailableKennelUnit(
        startDate,
        endDate,
        dogs.length,
        largestDogSize(dogs.map((d) => d.size))
      )
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
              balanceDueDate,
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
    const daycareDuration = data.daycareDuration ?? "FULL_DAY"
    if (daycareDuration === "HALF_DAY" && !data.daycareHalfDaySlot) {
      return { status: "error", message: "Select AM or PM for a half day booking." }
    }
    // Past the AM cutoff for a booking dated today, neither Full Day nor an
    // AM half day describe a real remaining window.
    if (isPastDaycareHalfDayAmCutoff(date)) {
      if (daycareDuration === "FULL_DAY") {
        return {
          status: "error",
          message: "It's the afternoon, so today's Day Care is Half Day (PM) only.",
        }
      }
      if (data.daycareHalfDaySlot === "AM") {
        return {
          status: "error",
          message: "It's the afternoon, so today's AM half day session is no longer available. Choose PM instead.",
        }
      }
    }

    const duplicateConflict = await checkForDuplicateServiceBooking(data.dogIds, date, date)
    if (duplicateConflict) return duplicateConflict

    const gate = await checkVaccinationGate(data.dogIds, date)
    const statusGateOk = gate.ok || skipVaccinationGate
    if (skipVaccinationGate && !gate.ok) vaccinationGateOverridden = true
    if (!statusGateOk && !data.proceedWithoutValidVaccines) {
      return {
        status: "error",
        message: "Vaccinations are missing or expired.",
        missingVaccinations: gate.perDog
          .filter((d) => d.missingTypes.length > 0)
          .map((d) => ({ dogName: d.dogName, missingTypes: d.missingTypes })),
        canWatchlist: true,
      }
    }

    const availability = await isDaycareAvailable(date)
    if (availability.remaining < dogs.length) {
      return { status: "error", message: availability.reason ?? "Not enough daycare capacity on that date." }
    }

    const unitPricePence =
      daycareDuration === "HALF_DAY" && service.halfDayPricePence != null
        ? service.halfDayPricePence
        : service.basePricePence

    const pricing = await computeBookingPrice({
      serviceId: service.id,
      pricingModel: service.pricingModel,
      basePricePence: unitPricePence,
      dates: [date],
      dogCount: dogs.length,
      addons: [],
    })

    const balanceDueDate = await balanceDueDateFor(service.paymentTiming, date)

    const booking = await runCapacityCheckedTransaction(async (tx) => {
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
          daycareDuration,
          daycareHalfDaySlot: daycareDuration === "HALF_DAY" ? data.daycareHalfDaySlot : null,
          batchId: options?.batchId,
          ...paymentFieldsForGate(service.paymentTiming, pricing, statusGateOk),
          totalPence: pricing.totalPence,
          balanceDueDate,
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

    const duplicateConflict = await checkForDuplicateServiceBooking(data.dogIds, slot.date, slot.date)
    if (duplicateConflict) return duplicateConflict

    const gate = await checkVaccinationGate(data.dogIds, slot.date)
    const statusGateOk = gate.ok || skipVaccinationGate
    if (skipVaccinationGate && !gate.ok) vaccinationGateOverridden = true
    if (!statusGateOk && !data.proceedWithoutValidVaccines) {
      return {
        status: "error",
        message: "Vaccinations are missing or expired.",
        missingVaccinations: gate.perDog
          .filter((d) => d.missingTypes.length > 0)
          .map((d) => ({ dogName: d.dogName, missingTypes: d.missingTypes })),
        canWatchlist: true,
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

    const balanceDueDate = await balanceDueDateFor(service.paymentTiming, slot.date)

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
          ...paymentFieldsForGate(service.paymentTiming, pricing, statusGateOk),
          totalPence: pricing.totalPence,
          balanceDueDate,
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

    const duplicateConflict = await checkForDuplicateServiceBooking(data.dogIds, run.date, run.date)
    if (duplicateConflict) return duplicateConflict

    const gate = await checkVaccinationGate(data.dogIds, run.date)
    const statusGateOk = gate.ok || skipVaccinationGate
    if (skipVaccinationGate && !gate.ok) vaccinationGateOverridden = true
    if (!statusGateOk && !data.proceedWithoutValidVaccines) {
      return {
        status: "error",
        message: "Vaccinations are missing or expired.",
        missingVaccinations: gate.perDog
          .filter((d) => d.missingTypes.length > 0)
          .map((d) => ({ dogName: d.dogName, missingTypes: d.missingTypes })),
        canWatchlist: true,
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

    const balanceDueDate = await balanceDueDateFor(service.paymentTiming, run.date)

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
          ...paymentFieldsForGate(service.paymentTiming, pricing, statusGateOk),
          totalPence: pricing.totalPence,
          balanceDueDate,
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

    const duplicateConflict = await checkForDuplicateServiceBooking(data.dogIds, date, date)
    if (duplicateConflict) return duplicateConflict

    const gate = await checkVaccinationGate(data.dogIds, date)
    const statusGateOk = gate.ok || skipVaccinationGate
    if (skipVaccinationGate && !gate.ok) vaccinationGateOverridden = true
    if (!statusGateOk && !data.proceedWithoutValidVaccines) {
      return {
        status: "error",
        message: "Vaccinations are missing or expired.",
        missingVaccinations: gate.perDog
          .filter((d) => d.missingTypes.length > 0)
          .map((d) => ({ dogName: d.dogName, missingTypes: d.missingTypes })),
        canWatchlist: true,
      }
    }

    const availability = await isMeetGreetAvailable(date)
    if (!availability.available) {
      return {
        status: "error",
        message: availability.reason ?? "There's already a Meet & Greet booked for this day.",
      }
    }

    const pricing = await computeBookingPrice({
      serviceId: service.id,
      pricingModel: service.pricingModel,
      basePricePence: service.basePricePence,
      dates: [date],
      dogCount: dogs.length,
      addons: [],
    })

    const balanceDueDate = await balanceDueDateFor(service.paymentTiming, date)

    const booking = await runCapacityCheckedTransaction(async (tx) => {
      const recheckCount = await tx.booking.count({
        where: {
          startDate: date,
          service: { slug: "meet-greet" },
          status: { notIn: ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_ADMIN", "NO_SHOW"] },
        },
      })
      if (recheckCount > 0) {
        throw new Error("MEET_GREET_FULL")
      }
      const created = await tx.booking.create({
        data: {
          customerId,
          serviceId: service.id,
          startDate: date,
          endDate: date,
          ...paymentFieldsForGate(service.paymentTiming, pricing, statusGateOk),
          totalPence: pricing.totalPence,
          balanceDueDate,
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
  // send it at creation. DEPOSIT_THEN_BALANCE bookings stay PENDING_PAYMENT
  // here — nothing has been paid yet — so they get the deposit-invoice
  // variant instead (full cost/VAT breakdown, deposit due now, balance due
  // later); the post-payment bookingConfirmationEmail is deliberately *not*
  // also sent once their deposit clears, to avoid two invoice-style emails
  // for one booking — see the becameConfirmed branches in payments.ts,
  // admin/bookings/actions.ts, and portal/bookings/actions.ts, each of
  // which skips it for this same paymentTiming. FULL_UPFRONT gets neither
  // email here — it still gets the existing post-payment confirmation once
  // paid, same as before. A failed email must not fail the booking itself.
  if (service.paymentTiming === "INVOICE_AFTER" || service.paymentTiming === "DEPOSIT_THEN_BALANCE") {
    try {
      const [settings, vat, customer, booking] = await Promise.all([
        getSettings(),
        getVatSettings(),
        prisma.user.findUniqueOrThrow({ where: { id: customerId } }),
        prisma.booking.findUniqueOrThrow({ where: { id: bookingId! } }),
      ])
      const invoiceBooking = {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        customerName: fullName(customer),
        serviceSlug: service.slug,
        serviceName: service.name,
        paymentTiming: service.paymentTiming,
        startDate: booking.startDate,
        endDate: booking.endDate,
        totalPence: booking.totalPence,
        depositPence: booking.depositPence,
        balanceDueDate: booking.balanceDueDate,
        dogNames: dogs.map((dog) => dog.name),
        customerNumber: customer.customerNumber,
        otherDaycareDates: (options?.otherDaycareDates ?? []).map((d) => startOfDay(new Date(d))),
        addons: data.addons.map((a) => {
          const addon = addonRecords.find((record) => record.id === a.addonId)!
          return { name: addon.name, quantity: a.quantity, totalPence: addon.pricePence * a.quantity }
        }),
      }
      // INVOICE_AFTER has no payment step to land the gate re-check on later
      // (see resolveBookingStatusForGate) — it's already known here whether
      // this landed as PENDING_VACCINATION, so send that email instead of a
      // normal confirmation. DEPOSIT_THEN_BALANCE always gets the deposit
      // invoice here regardless (nothing's paid yet, so PENDING_VACCINATION
      // vs CONFIRMED isn't decided until payment clears — see payments.ts).
      if (booking.status === "PENDING_VACCINATION") {
        const gateNow = await checkVaccinationGate(data.dogIds, booking.endDate)
        const missingSummary = gateNow.perDog
          .filter((d) => d.missingTypes.length > 0)
          .map((d) => `${d.dogName} (${d.missingTypes.join(", ")})`)
          .join("; ")
        const pending = pendingVaccinationEmail(settings, invoiceBooking, missingSummary, "initial")
        await sendEmail({ to: customer.email, subject: pending.subject, html: pending.html })
      } else {
        const confirmation =
          service.paymentTiming === "DEPOSIT_THEN_BALANCE"
            ? await bookingConfirmationDepositInvoiceEmail(
                settings,
                invoiceBooking,
                vat,
                `${getSiteUrl()}/book/confirmation/${booking.id}`
              )
            : await bookingConfirmationEmail(settings, invoiceBooking, vat, `${getSiteUrl()}/portal/bookings`)
        await sendEmail({ to: customer.email, subject: confirmation.subject, html: confirmation.html })
      }
    } catch (error) {
      console.error("[booking] failed to send booking confirmation email", error)
    }
  }

  const createdBooking = await prisma.booking.findUnique({
    where: { id: bookingId! },
    select: {
      startDate: true,
      endDate: true,
      customer: { select: { forename: true, surname: true, email: true } },
    },
  })
  const dateSummary = createdBooking
    ? createdBooking.startDate.getTime() === createdBooking.endDate.getTime()
      ? createdBooking.startDate.toLocaleDateString("en-GB")
      : `${createdBooking.startDate.toLocaleDateString("en-GB")} – ${createdBooking.endDate.toLocaleDateString("en-GB")}`
    : ""
  await logAudit({
    actorId: options?.actorId ?? customerId,
    action: "CREATE_BOOKING",
    entity: "Booking",
    entityId: bookingId!,
    meta: `${service.name} — ${dateSummary} — ${dogs.map((dog) => dog.name).join(", ")} — owner ${createdBooking?.customer ? fullName(createdBooking.customer) : "Unknown"} <${createdBooking?.customer.email}>`,
  })

  if (vaccinationGateOverridden && options?.overriddenByUserId) {
    await logAudit({
      actorId: options.overriddenByUserId,
      action: "OVERRIDE_VACCINATION_GATE",
      entity: "Booking",
      entityId: bookingId!,
      meta: `service=${service.slug} — dog(s) ${dogs.map((dog) => dog.name).join(", ")} not fully vaccinated for this date, booked anyway by admin`,
    })
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

export type MultiBookingActionState = BookingActionState & { failedDates?: string[] }

/**
 * Day care only, for booking several dates in one pass. Each date becomes
 * its own booking — same creation path as a single-date booking, just
 * looped — so one date failing (no capacity, missing vaccinations, etc.)
 * doesn't stop the others from going through.
 */
export async function createDaycareBookings(
  dates: string[],
  input: Omit<z.infer<typeof baseSchema>, "date" | "serviceSlug">
): Promise<MultiBookingActionState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Please log in to book." }
  if (dates.length === 0) return { status: "error", message: "Select at least one date." }

  const bookingIds: string[] = []
  const failedDates: string[] = []
  let lastError: BookingCreationResult | null = null
  const batchId = dates.length > 1 ? randomUUID() : undefined

  for (const date of dates) {
    const result = await resolveBookingCreation(
      session.user.id,
      { ...input, serviceSlug: "daycare", date },
      { batchId, otherDaycareDates: dates.filter((d) => d !== date) }
    )
    if (result.status === "error") {
      failedDates.push(date)
      lastError = result
    } else if (result.bookingId) {
      bookingIds.push(result.bookingId)
    }
  }

  if (bookingIds.length === 0) {
    return {
      status: "error",
      message: lastError?.message ?? "Could not create any bookings.",
      missingVaccinations: lastError?.missingVaccinations,
      canWatchlist: lastError?.canWatchlist,
      requiresTrialVisit: lastError?.requiresTrialVisit,
      failedDates,
    }
  }

  revalidatePath("/portal/bookings")
  redirect(`/book/confirmation/multi?ids=${bookingIds.join(",")}${failedDates.length > 0 ? `&failed=${failedDates.length}` : ""}`)
}
