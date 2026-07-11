"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import type { TrialOutcome } from "@/generated/prisma/client"

export type StaffActionState = { status: "idle" | "error"; message?: string }

async function requireStaff() {
  const session = await auth()
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "ADMIN")) {
    throw new Error("Unauthorized")
  }
  return session
}

export async function setTrialOutcome(
  trialVisitId: string,
  outcome: TrialOutcome,
  notes: string
): Promise<StaffActionState> {
  await requireStaff()

  const trialVisit = await prisma.trialVisit.findUnique({ where: { id: trialVisitId } })
  if (!trialVisit) return { status: "error", message: "Trial visit not found." }

  await prisma.trialVisit.update({
    where: { id: trialVisitId },
    data: { outcome, notes: notes.trim() || null, completedAt: new Date() },
  })

  revalidatePath("/staff/trials")
  return { status: "idle" }
}
