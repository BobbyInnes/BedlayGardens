"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

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

  await prisma.vaccinationRecord.update({
    where: { id: recordId },
    data: { status, verifiedById: session.user.id, verifiedAt: new Date() },
  })

  revalidatePath("/admin/vaccinations")
  revalidatePath("/portal/vaccinations")
}
