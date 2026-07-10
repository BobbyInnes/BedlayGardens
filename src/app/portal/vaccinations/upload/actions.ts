"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

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

  await prisma.vaccinationRecord.createMany({
    data: entries.map((entry) => ({
      dogId,
      type: entry.type,
      dateGiven: new Date(entry.dateGiven),
      expiryDate: new Date(entry.expiryDate),
      documentUrl: entry.fileKey,
      status: "UNVERIFIED" as const,
    })),
  })

  revalidatePath("/portal/vaccinations")
  return { status: "success" }
}
