"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }
  return session
}

export async function verifyVaccinationRecord(
  recordId: string,
  status: "VERIFIED" | "EXPIRED"
) {
  const session = await requireAdmin()

  const record = await prisma.vaccinationRecord.update({
    where: { id: recordId },
    data: { status, verifiedById: session.user.id, verifiedAt: new Date() },
    include: { dog: { include: { owner: true } } },
  })
  await logAudit({
    actorId: session.user.id,
    action: "VERIFY_VACCINATION_RECORD",
    entity: "VaccinationRecord",
    entityId: recordId,
    meta: `${record.type} — ${status} — ${record.dateGiven.toLocaleDateString("en-GB")} to ${record.expiryDate.toLocaleDateString("en-GB")} — ${record.dog.name}, owner ${record.dog.owner.name} <${record.dog.owner.email}>`,
  })

  revalidatePath("/admin/vaccinations")
  revalidatePath("/portal/vaccinations")
}

// Irreversible. Restricted to super admins, consistent with customer/booking
// deletion elsewhere in admin — regular admins/staff can only verify or mark
// records expired, not erase them.
export async function deleteVaccinationRecord(recordId: string) {
  const session = await requireAdmin()
  if (!session.user.isSuperAdmin) {
    throw new Error("Only a super admin can delete a vaccination record.")
  }

  const record = await prisma.vaccinationRecord.findUnique({
    where: { id: recordId },
    include: { dog: { include: { owner: true } } },
  })
  if (!record) {
    throw new Error("Vaccination record not found.")
  }

  await prisma.vaccinationRecord.delete({ where: { id: recordId } })
  await logAudit({
    actorId: session.user.id,
    action: "DELETE_VACCINATION_RECORD",
    entity: "VaccinationRecord",
    entityId: recordId,
    meta: `${record.type} — ${record.dateGiven.toLocaleDateString("en-GB")} to ${record.expiryDate.toLocaleDateString("en-GB")} — ${record.dog.name}, owner ${record.dog.owner.name} <${record.dog.owner.email}>`,
  })

  revalidatePath("/admin/vaccinations")
  revalidatePath("/staff/vaccinations")
  revalidatePath("/portal/vaccinations")
}
