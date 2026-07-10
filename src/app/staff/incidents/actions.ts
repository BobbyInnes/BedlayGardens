"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const incidentSchema = z.object({
  bookingId: z.string().min(1),
  dogId: z.string().min(1),
  severity: z.enum(["Low", "Medium", "High"]),
  description: z.string().trim().min(1, "Description is required").max(2000),
})

export type IncidentFormState = { status: "idle" | "error"; message?: string }

export async function createIncident(
  _prevState: IncidentFormState,
  formData: FormData
): Promise<IncidentFormState> {
  const session = await auth()
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "ADMIN")) {
    return { status: "error", message: "Unauthorized" }
  }

  const parsed = incidentSchema.safeParse({
    bookingId: formData.get("bookingId"),
    dogId: formData.get("dogId"),
    severity: formData.get("severity"),
    description: formData.get("description"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  await prisma.incidentReport.create({
    data: {
      bookingId: parsed.data.bookingId,
      dogId: parsed.data.dogId,
      reportedById: session.user.id,
      severity: parsed.data.severity,
      description: parsed.data.description,
    },
  })

  revalidatePath("/staff/incidents")
  return { status: "idle" }
}
