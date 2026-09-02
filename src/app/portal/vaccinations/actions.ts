"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"
import { saveUpload, deleteUpload } from "@/lib/storage"
import { checkWaitlistAfterVaccination } from "@/lib/waitlist"
import { notifyVaccinationReviewNeeded } from "@/lib/vaccination-review-notify"
import { FIXED_VACCINES } from "./vaccine-types"

const rowSchema = z.object({
  type: z.string().trim().min(1, "Vaccine type is required").max(100),
  dateGiven: z.string().min(1, "Date given is required"),
  expiryDate: z.string().min(1, "Expiry date is required"),
})

// The fixed vaccines (DHPP, Leptospirosis, Kennel Cough) don't take an
// expiry date from the form at all — it's calculated from the from date, so
// it's never something the visitor can enter or tamper with.
const fixedRowSchema = z.object({
  type: z.string().trim().min(1).max(100),
  dateGiven: z.string().min(1, "Date given is required"),
})

export type VaccinationFormState = {
  status: "idle" | "error"
  message?: string
  fieldErrors?: Record<string, string>
}

// Calendar-date add, not a fixed day count, so it's not thrown off by leap
// years. Used both to derive a fixed vaccine's expiry from its from date.
function addYears(dateStr: string, years: number): string {
  const date = new Date(dateStr)
  date.setFullYear(date.getFullYear() + years)
  return date.toISOString().slice(0, 10)
}

// The from date itself shouldn't be able to predate today by more than this
// many years (e.g. DHPP given "5 years ago"), independent of the validity
// gap above.
function isMoreThanYearsAgo(dateGiven: string, maxYears: number): boolean {
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - maxYears)
  return new Date(dateGiven).getTime() < cutoff.getTime()
}

async function requireDogOwnership(dogId: string) {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")
  const dog = await prisma.dog.findUnique({ where: { id: dogId } })
  if (!dog || dog.ownerId !== session.user.id) throw new Error("Dog not found")
  return { session, dog }
}

type PendingRow = {
  type: string
  dateGiven: string
  expiryDate: string
}

export async function createVaccinationManual(
  _prevState: VaccinationFormState,
  formData: FormData
): Promise<VaccinationFormState> {
  const dogId = String(formData.get("dogId") ?? "")
  if (!dogId) {
    return { status: "error", message: "Missing dog." }
  }

  const { session, dog } = await requireDogOwnership(dogId)

  const rows: PendingRow[] = []
  const fieldErrors: Record<string, string> = {}

  // Don't let a new record be added for a vaccine the dog is already
  // currently covered for — only once the existing one is closer to expiry
  // (or has expired) should a replacement be added.
  async function activeDuplicateError(type: string): Promise<string | null> {
    const existing = await prisma.vaccinationRecord.findFirst({
      where: { dogId, type: { equals: type, mode: "insensitive" }, expiryDate: { gte: new Date() } },
      orderBy: { expiryDate: "desc" },
    })
    if (!existing) return null
    return `${dog.name} already has a valid ${type} vaccination, expiring ${existing.expiryDate.toLocaleDateString("en-GB")}.`
  }

  for (const vaccine of FIXED_VACCINES) {
    if (formData.get(`enabled_${vaccine.id}`) !== "on") continue
    const dateGiven = String(formData.get(`dateGiven_${vaccine.id}`) ?? "")
    const parsed = fixedRowSchema.safeParse({ type: vaccine.type, dateGiven })
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (issue.path[0] !== "type") fieldErrors[`${String(issue.path[0])}_${vaccine.id}`] = issue.message
      }
      continue
    }
    if (vaccine.maxFromDateAgeYears && isMoreThanYearsAgo(parsed.data.dateGiven, vaccine.maxFromDateAgeYears)) {
      const years = vaccine.maxFromDateAgeYears
      fieldErrors[`dateGiven_${vaccine.id}`] =
        `From Date can't be more than ${years} year${years === 1 ? "" : "s"} ago for ${vaccine.type}. Please correct it.`
      continue
    }
    const duplicateError = await activeDuplicateError(vaccine.type)
    if (duplicateError) {
      fieldErrors[`dateGiven_${vaccine.id}`] = duplicateError
      continue
    }
    rows.push({
      type: parsed.data.type,
      dateGiven: parsed.data.dateGiven,
      expiryDate: addYears(parsed.data.dateGiven, vaccine.maxValidityYears),
    })
  }

  if (formData.get("enabled_Other") === "on") {
    const otherType = String(formData.get("otherType") ?? "")
    const dateGiven = String(formData.get("dateGiven_Other") ?? "")
    const expiryDate = String(formData.get("expiryDate_Other") ?? "")
    const parsed = rowSchema.safeParse({ type: otherType, dateGiven, expiryDate })
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] === "type" ? "otherType" : `${String(issue.path[0])}_Other`
        fieldErrors[field] = issue.message
      }
    } else {
      const duplicateError = await activeDuplicateError(parsed.data.type)
      if (duplicateError) {
        fieldErrors.otherType = duplicateError
      } else {
        rows.push(parsed.data)
      }
    }
  }

  const certificate = formData.get("certificate")
  const hasCertificate = certificate instanceof File && certificate.size > 0
  if (!hasCertificate) {
    fieldErrors.certificate = "A related vaccine certificate is required."
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", fieldErrors, message: "Please fix the errors below." }
  }

  if (rows.length === 0) {
    return { status: "error", message: "Select at least one vaccine to add." }
  }

  const buffer = Buffer.from(await (certificate as File).arrayBuffer())
  const documentUrl = await saveUpload(`vaccinations/${dogId}`, (certificate as File).name, buffer)

  const created = []
  for (const row of rows) {
    created.push(
      await prisma.vaccinationRecord.create({
        data: {
          dogId,
          type: row.type,
          dateGiven: new Date(row.dateGiven),
          expiryDate: new Date(row.expiryDate),
          documentUrl,
          status: "UNVERIFIED",
        },
      })
    )
  }

  for (const record of created) {
    await logAudit({
      actorId: session.user.id,
      action: "CREATE_VACCINATION_RECORD",
      entity: "VaccinationRecord",
      entityId: record.id,
      meta: `${record.type} for ${dog.name}, owner ${session.user.name} <${session.user.email}> — ${record.dateGiven.toLocaleDateString("en-GB")} to ${record.expiryDate.toLocaleDateString("en-GB")} — entered manually`,
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
  redirect("/portal/vaccinations")
}

export async function deleteVaccination(recordId: string) {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  const record = await prisma.vaccinationRecord.findUnique({
    where: { id: recordId },
    include: { dog: true },
  })
  if (!record || record.dog.ownerId !== session.user.id) {
    throw new Error("Record not found")
  }

  if (record.documentUrl) {
    await deleteUpload(record.documentUrl).catch(() => {})
  }
  await prisma.vaccinationRecord.delete({ where: { id: recordId } })
  revalidatePath("/portal/vaccinations")
}
