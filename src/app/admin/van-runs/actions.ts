"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { startOfDay } from "@/lib/dates"
import { logAudit } from "@/lib/audit"

export type AdminActionState = { status: "idle" | "error"; message?: string }

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }
  return session
}

const vanRunSchema = z.object({
  date: z.string().min(1, "Select a date"),
  name: z.string().trim().min(1, "Name is required").max(100),
  startTime: z.string().trim().min(1, "Start time is required").max(20),
  maxDogs: z.coerce.number().int().min(1).max(50),
  staffId: z.string().optional(),
})

export async function createVanRun(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const staffIdRaw = formData.get("staffId") as string | null
  const parsed = vanRunSchema.safeParse({
    date: formData.get("date"),
    name: formData.get("name"),
    startTime: formData.get("startTime"),
    maxDogs: formData.get("maxDogs"),
    staffId: staffIdRaw === "NONE" ? "" : staffIdRaw,
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const vanRun = await prisma.vanRun.create({
    data: {
      date: startOfDay(new Date(parsed.data.date)),
      name: parsed.data.name,
      startTime: parsed.data.startTime,
      maxDogs: parsed.data.maxDogs,
      staffId: parsed.data.staffId || null,
    },
  })
  await logAudit({
    actorId: session.user.id,
    action: "CREATE_VAN_RUN",
    entity: "VanRun",
    entityId: vanRun.id,
    meta: `${parsed.data.name} — ${parsed.data.date} ${parsed.data.startTime}`,
  })

  revalidatePath("/admin/van-runs")
  redirect("/admin/van-runs")
}

export async function updateVanRun(
  vanRunId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const staffIdRaw = formData.get("staffId") as string | null
  const parsed = vanRunSchema.safeParse({
    date: formData.get("date"),
    name: formData.get("name"),
    startTime: formData.get("startTime"),
    maxDogs: formData.get("maxDogs"),
    staffId: staffIdRaw === "NONE" ? "" : staffIdRaw,
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  await prisma.vanRun.update({
    where: { id: vanRunId },
    data: {
      date: startOfDay(new Date(parsed.data.date)),
      name: parsed.data.name,
      startTime: parsed.data.startTime,
      maxDogs: parsed.data.maxDogs,
      staffId: parsed.data.staffId || null,
    },
  })
  await logAudit({
    actorId: session.user.id,
    action: "UPDATE_VAN_RUN",
    entity: "VanRun",
    entityId: vanRunId,
    meta: `${parsed.data.name} — ${parsed.data.date} ${parsed.data.startTime}`,
  })

  revalidatePath("/admin/van-runs")
  revalidatePath(`/admin/van-runs/${vanRunId}`)
  redirect("/admin/van-runs")
}

export async function deleteVanRun(vanRunId: string) {
  const session = await requireAdmin()
  const stopCount = await prisma.vanRunStop.count({ where: { vanRunId } })
  if (stopCount > 0) return
  const vanRun = await prisma.vanRun.delete({ where: { id: vanRunId } })
  await logAudit({
    actorId: session.user.id,
    action: "DELETE_VAN_RUN",
    entity: "VanRun",
    entityId: vanRunId,
    meta: vanRun.name,
  })
  revalidatePath("/admin/van-runs")
}

export async function moveStop(vanRunId: string, stopId: string, direction: "up" | "down") {
  const session = await requireAdmin()
  const stops = await prisma.vanRunStop.findMany({
    where: { vanRunId },
    orderBy: { sortOrder: "asc" },
  })
  const index = stops.findIndex((s) => s.id === stopId)
  if (index === -1) return
  const swapWith = direction === "up" ? index - 1 : index + 1
  if (swapWith < 0 || swapWith >= stops.length) return

  const a = stops[index]
  const b = stops[swapWith]
  await prisma.$transaction([
    prisma.vanRunStop.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.vanRunStop.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ])
  await logAudit({
    actorId: session.user.id,
    action: "REORDER_VAN_RUN_STOP",
    entity: "VanRun",
    entityId: vanRunId,
    meta: `stop ${stopId} moved ${direction}`,
  })

  revalidatePath(`/admin/van-runs/${vanRunId}`)
}

export async function updateServiceAreaPostcodes(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const postcodes = (formData.get("postcodes") as string | null) ?? ""

  await prisma.setting.upsert({
    where: { key: "dog_walking_service_postcodes" },
    update: { value: postcodes.trim() },
    create: { key: "dog_walking_service_postcodes", value: postcodes.trim() },
  })
  await logAudit({
    actorId: session.user.id,
    action: "UPDATE_SETTING",
    entity: "Setting",
    entityId: "dog_walking_service_postcodes",
    meta: postcodes.trim() || "cleared",
  })

  revalidatePath("/admin/van-runs")
  return { status: "idle", message: "Service area updated." }
}
