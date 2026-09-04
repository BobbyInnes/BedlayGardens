"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logEntityChange } from "@/lib/audit"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }
  return session
}

// Per-dog admin overrides (Admin -> Dogs) — while set, this dog skips that
// check entirely everywhere it's enforced, regardless of what's on file or
// its trial history. See checkVaccinationGate / checkTrialGate.
export async function updateDogBypassChecks(
  dogId: string,
  field: "bypassVaccinationChecks" | "bypassMeetGreetChecks",
  value: boolean
): Promise<void> {
  const session = await requireAdmin()

  const before = await prisma.dog.findUniqueOrThrow({ where: { id: dogId } })
  await prisma.dog.update({ where: { id: dogId }, data: { [field]: value } })

  await logEntityChange({
    actorId: session.user.id,
    action: "UPDATE_DOG_BYPASS_CHECKS",
    entity: "Dog",
    entityId: dogId,
    context: `dog ${before.name}`,
    before,
    after: { [field]: value },
    labels: {
      bypassVaccinationChecks: "Bypass vaccination checks",
      bypassMeetGreetChecks: "Bypass Meet & Greet checks",
    },
  })

  revalidatePath("/admin/dogs")
}
