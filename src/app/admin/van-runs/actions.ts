"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { startOfDay } from "@/lib/dates"

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
  await requireAdmin()
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

  await prisma.vanRun.create({
    data: {
      date: startOfDay(new Date(parsed.data.date)),
      name: parsed.data.name,
      startTime: parsed.data.startTime,
      maxDogs: parsed.data.maxDogs,
      staffId: parsed.data.staffId || null,
    },
  })

  revalidatePath("/admin/van-runs")
  redirect("/admin/van-runs")
}

export async function updateVanRun(
  vanRunId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
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

  revalidatePath("/admin/van-runs")
  revalidatePath(`/admin/van-runs/${vanRunId}`)
  redirect("/admin/van-runs")
}

export async function deleteVanRun(vanRunId: string) {
  await requireAdmin()
  const stopCount = await prisma.vanRunStop.count({ where: { vanRunId } })
  if (stopCount > 0) return
  await prisma.vanRun.delete({ where: { id: vanRunId } })
  revalidatePath("/admin/van-runs")
}

export async function moveStop(vanRunId: string, stopId: string, direction: "up" | "down") {
  await requireAdmin()
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

  revalidatePath(`/admin/van-runs/${vanRunId}`)
}

export async function updateServiceAreaPostcodes(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const postcodes = (formData.get("postcodes") as string | null) ?? ""

  await prisma.setting.upsert({
    where: { key: "dog_walking_service_postcodes" },
    update: { value: postcodes.trim() },
    create: { key: "dog_walking_service_postcodes", value: postcodes.trim() },
  })

  revalidatePath("/admin/van-runs")
  return { status: "idle", message: "Service area updated." }
}
