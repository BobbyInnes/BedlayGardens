"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"
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
  const session = await requireStaff()

  const trialVisit = await prisma.trialVisit.findUnique({
    where: { id: trialVisitId },
    include: { dog: true, booking: true },
  })
  if (!trialVisit) return { status: "error", message: "Trial visit not found." }
  if (trialVisit.booking.startDate > new Date()) {
    return { status: "error", message: "Can't set an outcome before the Meet & Greet date." }
  }

  await prisma.trialVisit.update({
    where: { id: trialVisitId },
    data: { outcome, notes: notes.trim() || null, completedAt: new Date() },
  })

  await logAudit({
    actorId: session.user.id,
    action: "SET_MEET_GREET_OUTCOME",
    entity: "TrialVisit",
    entityId: trialVisitId,
    meta: `${trialVisit.dog.name} — ${outcome}`,
  })

  revalidatePath("/staff/trials")
  return { status: "idle" }
}
