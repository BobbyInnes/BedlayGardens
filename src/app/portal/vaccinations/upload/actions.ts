"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"

const entrySchema = z.object({
  type: z.string().trim().min(1).max(100),
  dateGiven: z.string().min(1),
  expiryDate: z.string().min(1),
  fileKey: z.string().nullable(),
})

const payloadSchema = z.object({
  dogId: z.string().min(1),
  entries: z.array(entrySchema).min(1),
})

export type SaveExtractedResult = { status: "success" } | { status: "error"; message: string }

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

  const created = await prisma.vaccinationRecord.createManyAndReturn({
    data: entries.map((entry) => ({
      dogId,
      type: entry.type,
      dateGiven: new Date(entry.dateGiven),
      expiryDate: new Date(entry.expiryDate),
      documentUrl: entry.fileKey,
      status: "UNVERIFIED" as const,
    })),
  })

  for (const record of created) {
    await logAudit({
      actorId: session.user.id,
      action: "CREATE_VACCINATION_RECORD",
      entity: "VaccinationRecord",
      entityId: record.id,
      meta: `${record.type} for ${dog.name}, owner ${session.user.name} <${session.user.email}> — from uploaded certificate`,
    })
  }

  revalidatePath("/portal/vaccinations")
  return { status: "success" }
}
