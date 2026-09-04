"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"
import type { TrialOutcome } from "@/generated/prisma/client"
import { fullName } from "@/lib/format"

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
  notes: string,
  validUntil: string
): Promise<StaffActionState> {
  const session = await requireStaff()

  const trialVisit = await prisma.trialVisit.findUnique({
    where: { id: trialVisitId },
    include: { dog: true, booking: { include: { customer: true } } },
  })
  if (!trialVisit) return { status: "error", message: "Trial visit not found." }
  if (trialVisit.booking.startDate > new Date()) {
    return { status: "error", message: "Can't set an outcome before the Meet & Greet date." }
  }

  await prisma.trialVisit.update({
    where: { id: trialVisitId },
    data: {
      outcome,
      notes: notes.trim() || null,
      completedAt: new Date(),
      validUntil: validUntil ? new Date(validUntil) : null,
    },
  })

  await logAudit({
    actorId: session.user.id,
    action: "SET_MEET_GREET_OUTCOME",
    entity: "TrialVisit",
    entityId: trialVisitId,
    meta: `${trialVisit.dog.name} — ${outcome} — owner ${fullName(trialVisit.booking.customer)} <${trialVisit.booking.customer.email}>`,
  })

  revalidatePath("/staff/trials")
  return { status: "idle" }
}

// Lets an admin approve a Meet & Greet before its date has actually passed —
// e.g. a booking created purely to test the flow, never meant to be a real
// visit. Deliberately its own action rather than a flag on setTrialOutcome:
// fixed outcome/notes, no free-text override, so there's no way to sneak an
// early real approval past the date check through this door.
export async function approveTrialAsTestCase(trialVisitId: string): Promise<StaffActionState> {
  const session = await requireStaff()
  if (session.user.role !== "ADMIN") {
    return { status: "error", message: "Only an admin can approve a Meet & Greet as a test case." }
  }

  const trialVisit = await prisma.trialVisit.findUnique({
    where: { id: trialVisitId },
    include: { dog: true, booking: { include: { customer: true } } },
  })
  if (!trialVisit) return { status: "error", message: "Trial visit not found." }

  await prisma.trialVisit.update({
    where: { id: trialVisitId },
    data: {
      outcome: "PASSED",
      notes: "Approved by admin as a test case",
      completedAt: new Date(),
    },
  })

  await logAudit({
    actorId: session.user.id,
    action: "SET_MEET_GREET_OUTCOME",
    entity: "TrialVisit",
    entityId: trialVisitId,
    meta: `${trialVisit.dog.name} — PASSED (test case, approved before the Meet & Greet date) — owner ${fullName(trialVisit.booking.customer)} <${trialVisit.booking.customer.email}>`,
  })

  revalidatePath("/staff/trials")
  return { status: "idle" }
}
