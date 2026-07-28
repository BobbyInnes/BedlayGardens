"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"

async function requireStaff() {
  const session = await auth()
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "ADMIN")) {
    throw new Error("Unauthorized")
  }
  return session
}

export async function verifyVaccinationRecord(
  recordId: string,
  status: "VERIFIED" | "EXPIRED"
) {
  const session = await requireStaff()

  const record = await prisma.vaccinationRecord.update({
    where: { id: recordId },
    data: { status, verifiedById: session.user.id, verifiedAt: new Date() },
  })
  await logAudit({
    actorId: session.user.id,
    action: "VERIFY_VACCINATION_RECORD",
    entity: "VaccinationRecord",
    entityId: recordId,
    meta: `${record.type} — ${status}`,
  })

  revalidatePath("/staff/vaccinations")
  revalidatePath("/admin/vaccinations")
  revalidatePath("/portal/vaccinations")
}
