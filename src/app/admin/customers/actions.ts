"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"
import { sendEmail } from "@/lib/email"
import { getSettings } from "@/lib/settings"
import { formatPence } from "@/lib/format"
import { canManageAdmins } from "@/lib/admin-permissions"
import type { DogFlagType } from "@/generated/prisma/client"

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

/**
 * Converts an existing customer account into a Staff/Admin account, rather
 * than requiring a brand new user (email must be unique across every role,
 * so someone who's already booked as a customer can't otherwise be added as
 * staff under the same address). Keeps their existing password — an admin
 * can reset it afterwards from the staff edit page if needed.
 */
export async function promoteCustomerToStaff(customerId: string, role: "STAFF" | "ADMIN") {
  const session = await requireAdmin()
  const customer = await prisma.user.findFirst({ where: { id: customerId, role: "CUSTOMER" } })
  if (!customer) {
    throw new Error("Customer not found.")
  }
  if (role === "ADMIN" && !(await canManageAdmins(session))) {
    throw new Error("Only a super admin can promote someone to admin.")
  }

  await prisma.user.update({ where: { id: customerId }, data: { role } })
  await logAudit({
    actorId: session.user.id,
    action: "PROMOTE_CUSTOMER_TO_STAFF",
    entity: "User",
    entityId: customerId,
    meta: role,
  })

  revalidatePath("/admin/customers")
  revalidatePath("/admin/staff")
  redirect(`/admin/staff/${customerId}`)
}

export async function addDogFlag(
  customerId: string,
  dogId: string,
  type: DogFlagType,
  notes: string
) {
  const session = await requireAdmin()
  await prisma.dogFlag.create({ data: { dogId, type, notes: notes.trim() || null } })
  await logAudit({
    actorId: session.user.id,
    action: "ADD_DOG_FLAG",
    entity: "Dog",
    entityId: dogId,
    meta: type,
  })
  revalidatePath(`/admin/customers/${customerId}`)
}

export async function removeDogFlag(customerId: string, flagId: string) {
  const session = await requireAdmin()
  const flag = await prisma.dogFlag.findUnique({ where: { id: flagId } })
  if (!flag) return
  await prisma.dogFlag.delete({ where: { id: flagId } })
  await logAudit({
    actorId: session.user.id,
    action: "REMOVE_DOG_FLAG",
    entity: "Dog",
    entityId: flag.dogId,
    meta: flag.type,
  })
  revalidatePath(`/admin/customers/${customerId}`)
}

export async function issueGoodwillCredit(
  customerId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const amountPence = Math.round(Number(formData.get("amountPounds")) * 100)
  const reason = ((formData.get("reason") as string | null) ?? "").trim()

  if (!amountPence || amountPence <= 0) {
    return { status: "error", message: "Enter a positive amount." }
  }

  await prisma.creditLedger.create({
    data: { customerId, amountPence, reason: reason || "Goodwill credit" },
  })
  await logAudit({
    actorId: session.user.id,
    action: "ISSUE_GOODWILL_CREDIT",
    entity: "User",
    entityId: customerId,
    meta: `${amountPence}p — ${reason}`,
  })

  const customer = await prisma.user.findUnique({ where: { id: customerId } })
  if (customer) {
    const settings = await getSettings()
    await sendEmail({
      to: customer.email,
      subject: "Account credit added",
      html: `<p>We've added ${formatPence(amountPence)} of account credit to your ${settings.business_name ?? "Bedlay Gardens LTD"} account${reason ? `: ${reason}` : "."}</p>`,
    })
  }

  revalidatePath(`/admin/customers/${customerId}`)
  return { status: "idle", message: "Credit issued." }
}
