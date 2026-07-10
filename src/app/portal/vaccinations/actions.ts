"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { saveUpload, deleteUpload } from "@/lib/storage"

const manualSchema = z.object({
  dogId: z.string().min(1),
  type: z.string().trim().min(1, "Vaccine type is required").max(100),
  dateGiven: z.string().min(1, "Date given is required"),
  expiryDate: z.string().min(1, "Expiry date is required"),
})

export type VaccinationFormState = {
  status: "idle" | "error"
  message?: string
  fieldErrors?: Record<string, string>
}

async function requireDogOwnership(dogId: string) {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")
  const dog = await prisma.dog.findUnique({ where: { id: dogId } })
  if (!dog || dog.ownerId !== session.user.id) throw new Error("Dog not found")
  return dog
}

export async function createVaccinationManual(
  _prevState: VaccinationFormState,
  formData: FormData
): Promise<VaccinationFormState> {
  const parsed = manualSchema.safeParse({
    dogId: formData.get("dogId"),
    type: formData.get("type"),
    dateGiven: formData.get("dateGiven"),
    expiryDate: formData.get("expiryDate"),
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message
    }
    return { status: "error", fieldErrors, message: "Please fix the errors below." }
  }

  const { dogId, type, dateGiven, expiryDate } = parsed.data
  await requireDogOwnership(dogId)

  let documentUrl: string | null = null
  const certificate = formData.get("certificate")
  if (certificate instanceof File && certificate.size > 0) {
    const buffer = Buffer.from(await certificate.arrayBuffer())
    documentUrl = await saveUpload(`vaccinations/${dogId}`, certificate.name, buffer)
  }

  await prisma.vaccinationRecord.create({
    data: {
      dogId,
      type,
      dateGiven: new Date(dateGiven),
      expiryDate: new Date(expiryDate),
      documentUrl,
      status: "UNVERIFIED",
    },
  })

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
