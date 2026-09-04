"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { logAudit, logEntityChange } from "@/lib/audit"
import { deleteUpload } from "@/lib/storage"
import { fullName } from "@/lib/format"

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

// Restricted to super admins, consistent with customer/booking deletion.
// Deliberately no cascading history cleanup (unlike deleteCustomerAndAllData)
// — this mirrors the customer's own portal deleteDog: only a dog with no
// booking/vaccination/etc. history can actually be removed this way, so
// "delete the wrong duplicate dog" stays safe and there's no risk of quietly
// erasing a customer's real history via the admin side. If a dog does have
// history, delete the whole customer instead (which does cascade) or ask a
// developer for a one-off fix.
export async function deleteDogAdmin(dogId: string): Promise<{ error?: string }> {
  const session = await requireAdmin()
  if (!session.user.isSuperAdmin) {
    return { error: "Only a super admin can delete a dog." }
  }

  const dog = await prisma.dog.findUnique({ where: { id: dogId }, include: { owner: true } })
  if (!dog) {
    return { error: "Dog not found." }
  }

  try {
    await prisma.dog.delete({ where: { id: dogId } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return {
        error:
          "This dog can't be deleted because it has booking history — delete the customer instead if you need it fully removed.",
      }
    }
    throw error
  }

  await logAudit({
    actorId: session.user.id,
    action: "DELETE_DOG",
    entity: "Dog",
    entityId: dogId,
    meta: `${dog.name} (${dog.breed}) — owner ${fullName(dog.owner)} <${dog.owner.email}>`,
  })

  if (dog.photoUrl) {
    await deleteUpload(dog.photoUrl).catch(() => {})
  }

  revalidatePath("/admin/dogs")
  return {}
}
