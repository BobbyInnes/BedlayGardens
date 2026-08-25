"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"
import { notifyCustomerVaccinationReviewed } from "@/lib/vaccination-review-notify"
import { fullName } from "@/lib/format"

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
    include: { dog: { include: { owner: true } } },
  })
  await logAudit({
    actorId: session.user.id,
    action: "VERIFY_VACCINATION_RECORD",
    entity: "VaccinationRecord",
    entityId: recordId,
    meta: `${record.type} — ${status} — ${record.dateGiven.toLocaleDateString("en-GB")} to ${record.expiryDate.toLocaleDateString("en-GB")} — ${record.dog.name}, owner ${fullName(record.dog.owner)} <${record.dog.owner.email}>`,
  })
  await notifyCustomerVaccinationReviewed({
    customerId: record.dog.ownerId,
    dogName: record.dog.name,
    type: record.type,
    expiryDate: record.expiryDate,
    status,
  })

  revalidatePath("/staff/vaccinations")
  revalidatePath("/admin/vaccinations")
  revalidatePath("/portal/vaccinations")
}
