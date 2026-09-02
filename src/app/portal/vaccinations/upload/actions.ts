"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"
import { checkWaitlistAfterVaccination } from "@/lib/waitlist"
import { notifyVaccinationReviewNeeded } from "@/lib/vaccination-review-notify"
import { addYears, isMoreThanYearsAgo, findFixedVaccine, activeDuplicateError } from "@/lib/vaccination-validation"

const entrySchema = z.object({
  id: z.string().min(1),
  type: z.string().trim().min(1, "Vaccine type is required").max(100),
  dateGiven: z.string().min(1, "Date given is required"),
  expiryDate: z.string().min(1, "Expiry date is required"),
  fileKey: z.string().nullable(),
})

const payloadSchema = z.object({
  dogId: z.string().min(1),
  entries: z.array(entrySchema).min(1),
})

// Keyed by entry id (not index — entries can be removed/reordered in the
// review list), each holding whichever fields on that row have a problem.
export type EntryFieldErrors = { type?: string; dateGiven?: string; expiryDate?: string }

export type SaveExtractedResult =
  | { status: "success" }
  | { status: "error"; message: string; entryErrors?: Record<string, EntryFieldErrors> }

export async function saveExtractedVaccinations(
  input: z.infer<typeof payloadSchema>
): Promise<SaveExtractedResult> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Unauthorized" }

  const parsed = payloadSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: "Invalid submission." }
  }

  const { dogId, entries } = parsed.data
  const dog = await prisma.dog.findUnique({ where: { id: dogId } })
  if (!dog || dog.ownerId !== session.user.id) {
    return { status: "error", message: "Dog not found." }
  }

  // Same rules as the manual-entry form (src/app/portal/vaccinations/actions.ts):
  // a recognized fixed vaccine (DHPP, Leptospirosis, Kennel Cough) can't have
  // a from date further back than its usual validity window, has its expiry
  // derived from the from date rather than trusting whatever OCR read off the
  // certificate, and — fixed or free-text "Other" type alike — can't
  // duplicate a record the dog is already actively covered by.
  const entryErrors: Record<string, EntryFieldErrors> = {}
  const rows: { type: string; dateGiven: string; expiryDate: string; fileKey: string | null }[] = []

  for (const entry of entries) {
    const fixedVaccine = findFixedVaccine(entry.type)
    let expiryDate = entry.expiryDate

    if (fixedVaccine) {
      if (isMoreThanYearsAgo(entry.dateGiven, fixedVaccine.maxFromDateAgeYears)) {
        const years = fixedVaccine.maxFromDateAgeYears
        entryErrors[entry.id] = {
          dateGiven: `Date given can't be more than ${years} year${years === 1 ? "" : "s"} ago for ${fixedVaccine.type}. Please correct it.`,
        }
        continue
      }
      expiryDate = addYears(entry.dateGiven, fixedVaccine.maxValidityYears)
    }

    const duplicateError = await activeDuplicateError(dogId, dog.name, entry.type)
    if (duplicateError) {
      entryErrors[entry.id] = { dateGiven: duplicateError }
      continue
    }

    rows.push({ type: entry.type, dateGiven: entry.dateGiven, expiryDate, fileKey: entry.fileKey })
  }

  if (Object.keys(entryErrors).length > 0) {
    return { status: "error", message: "Please fix the errors highlighted.", entryErrors }
  }

  const created = await prisma.vaccinationRecord.createManyAndReturn({
    data: rows.map((row) => ({
      dogId,
      type: row.type,
      dateGiven: new Date(row.dateGiven),
      expiryDate: new Date(row.expiryDate),
      documentUrl: row.fileKey,
      status: "UNVERIFIED" as const,
    })),
  })

  for (const record of created) {
    await logAudit({
      actorId: session.user.id,
      action: "CREATE_VACCINATION_RECORD",
      entity: "VaccinationRecord",
      entityId: record.id,
      meta: `${record.type} for ${dog.name}, owner ${session.user.name} <${session.user.email}> — ${record.dateGiven.toLocaleDateString("en-GB")} to ${record.expiryDate.toLocaleDateString("en-GB")} — from uploaded certificate`,
    })
  }

  await checkWaitlistAfterVaccination(dogId)
  await notifyVaccinationReviewNeeded(
    created.map((record) => ({
      dogName: dog.name,
      ownerName: session.user.name ?? session.user.email ?? "Unknown",
      type: record.type,
      dateGiven: record.dateGiven,
      expiryDate: record.expiryDate,
    }))
  )

  revalidatePath("/portal/vaccinations")
  return { status: "success" }
}
