"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export type AdminActionState = { status: "idle" | "error"; message?: string }

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }
  return session
}

export async function updateCustomerNotes(
  customerId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const notes = ((formData.get("adminNotes") as string | null) ?? "").trim()

  await prisma.user.update({
    where: { id: customerId },
    data: { adminNotes: notes || null },
  })

  revalidatePath(`/admin/customers/${customerId}`)
  return { status: "idle", message: "Notes saved." }
}

export async function toggleCustomerActive(customerId: string, active: boolean) {
  await requireAdmin()
  await prisma.user.update({ where: { id: customerId }, data: { active } })
  revalidatePath("/admin/customers")
  revalidatePath(`/admin/customers/${customerId}`)
}
