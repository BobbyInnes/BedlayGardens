"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
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

const settingsSchema = z.object({
  deposit_percent: z.coerce.number().min(0).max(100),
  balance_due_days_before_checkin: z.coerce.number().int().min(0),
  cancellation_free_days: z.coerce.number().int().min(0),
  cancellation_no_refund_hours: z.coerce.number().int().min(0),
  second_dog_discount_percent: z.coerce.number().min(0).max(100),
  daycare_max_capacity: z.coerce.number().int().min(0),
  vat_enabled: z.enum(["true", "false"]),
  pupdates_included_free: z.enum(["true", "false"]),
})

export async function updateSettings(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const parsed = settingsSchema.safeParse({
    deposit_percent: formData.get("deposit_percent"),
    balance_due_days_before_checkin: formData.get("balance_due_days_before_checkin"),
    cancellation_free_days: formData.get("cancellation_free_days"),
    cancellation_no_refund_hours: formData.get("cancellation_no_refund_hours"),
    second_dog_discount_percent: formData.get("second_dog_discount_percent"),
    daycare_max_capacity: formData.get("daycare_max_capacity"),
    vat_enabled: formData.get("vat_enabled") === "on" ? "true" : "false",
    pupdates_included_free: formData.get("pupdates_included_free") === "on" ? "true" : "false",
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  await Promise.all(
    Object.entries(parsed.data).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    )
  )

  revalidatePath("/admin/pricing")
  return { status: "idle", message: "Settings saved." }
}

const kennelUnitSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  size: z.string().trim().min(1, "Size is required").max(50),
  dogCapacity: z.coerce.number().int().min(1),
})

export async function createKennelUnit(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const parsed = kennelUnitSchema.safeParse({
    name: formData.get("name"),
    size: formData.get("size"),
    dogCapacity: formData.get("dogCapacity"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const existing = await prisma.kennelUnit.findUnique({ where: { name: parsed.data.name } })
  if (existing) {
    return { status: "error", message: "A kennel with that name already exists." }
  }

  await prisma.kennelUnit.create({ data: parsed.data })
  revalidatePath("/admin/pricing")
  return { status: "idle" }
}

export async function updateKennelUnit(
  unitId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const parsed = kennelUnitSchema.safeParse({
    name: formData.get("name"),
    size: formData.get("size"),
    dogCapacity: formData.get("dogCapacity"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  await prisma.kennelUnit.update({ where: { id: unitId }, data: parsed.data })
  revalidatePath("/admin/pricing")
  redirect("/admin/pricing")
}

export async function toggleKennelUnitActive(unitId: string, active: boolean) {
  await requireAdmin()
  await prisma.kennelUnit.update({ where: { id: unitId }, data: { active } })
  revalidatePath("/admin/pricing")
}

export async function deleteKennelUnit(unitId: string) {
  await requireAdmin()
  const bookingCount = await prisma.booking.count({ where: { kennelUnitId: unitId } })
  if (bookingCount > 0) {
    await prisma.kennelUnit.update({ where: { id: unitId }, data: { active: false } })
  } else {
    await prisma.kennelUnit.delete({ where: { id: unitId } })
  }
  revalidatePath("/admin/pricing")
}

const blockedDateSchema = z.object({
  date: z.string().min(1),
  kennelUnitId: z.string().optional(),
  reason: z.string().trim().max(500).optional(),
})

export async function createBlockedDate(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const parsed = blockedDateSchema.safeParse({
    date: formData.get("date"),
    kennelUnitId: formData.get("kennelUnitId") || undefined,
    reason: formData.get("reason") || undefined,
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  await prisma.blockedDate.create({
    data: {
      date: new Date(parsed.data.date),
      kennelUnitId:
        parsed.data.kennelUnitId && parsed.data.kennelUnitId !== "site-wide"
          ? parsed.data.kennelUnitId
          : null,
      reason: parsed.data.reason || null,
    },
  })
  revalidatePath("/admin/pricing")
  return { status: "idle" }
}

export async function deleteBlockedDate(id: string) {
  await requireAdmin()
  await prisma.blockedDate.delete({ where: { id } })
  revalidatePath("/admin/pricing")
}
