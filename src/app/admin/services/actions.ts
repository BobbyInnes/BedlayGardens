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

const serviceSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  description: z.string().trim().min(1, "Description is required").max(2000),
  pricingModel: z.enum(["PER_NIGHT", "PER_DAY", "PER_SESSION"]),
  basePricePence: z.coerce.number().int().min(0),
  sortOrder: z.coerce.number().int().default(0),
})

function readServiceFields(formData: FormData) {
  return serviceSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    pricingModel: formData.get("pricingModel"),
    basePricePence: formData.get("basePricePence"),
    sortOrder: formData.get("sortOrder") || "0",
  })
}

export async function createService(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const parsed = readServiceFields(formData)
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const existing = await prisma.service.findUnique({ where: { slug: parsed.data.slug } })
  if (existing) {
    return { status: "error", message: "A service with that slug already exists." }
  }

  await prisma.service.create({ data: parsed.data })
  revalidatePath("/admin/services")
  revalidatePath("/services")
  revalidatePath("/book")
  redirect("/admin/services")
}

export async function updateService(
  serviceId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const parsed = readServiceFields(formData)
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const existing = await prisma.service.findFirst({
    where: { slug: parsed.data.slug, NOT: { id: serviceId } },
  })
  if (existing) {
    return { status: "error", message: "A service with that slug already exists." }
  }

  await prisma.service.update({ where: { id: serviceId }, data: parsed.data })
  revalidatePath("/admin/services")
  revalidatePath("/services")
  revalidatePath("/book")
  redirect("/admin/services")
}

export async function toggleServiceActive(serviceId: string, active: boolean) {
  await requireAdmin()
  await prisma.service.update({ where: { id: serviceId }, data: { active } })
  revalidatePath("/admin/services")
  revalidatePath("/services")
  revalidatePath("/book")
}

export async function deleteService(serviceId: string) {
  await requireAdmin()
  const bookingCount = await prisma.booking.count({ where: { serviceId } })

  if (bookingCount > 0) {
    await prisma.service.update({ where: { id: serviceId }, data: { active: false } })
  } else {
    await prisma.service.delete({ where: { id: serviceId } })
  }

  revalidatePath("/admin/services")
  revalidatePath("/services")
  revalidatePath("/book")
}

const addonSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  pricePence: z.coerce.number().int().min(0),
})

export async function createAddon(
  serviceId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const parsed = addonSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    pricePence: formData.get("pricePence"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  await prisma.addon.create({
    data: {
      serviceId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      pricePence: parsed.data.pricePence,
    },
  })
  revalidatePath(`/admin/services/${serviceId}`)
  revalidatePath("/services")
  return { status: "idle" }
}

export async function toggleAddonActive(addonId: string, active: boolean) {
  await requireAdmin()
  const addon = await prisma.addon.update({ where: { id: addonId }, data: { active } })
  revalidatePath(`/admin/services/${addon.serviceId}`)
  revalidatePath("/services")
}

export async function deleteAddon(addonId: string) {
  await requireAdmin()
  const addon = await prisma.addon.findUnique({ where: { id: addonId } })
  if (!addon) return
  const usageCount = await prisma.bookingAddon.count({ where: { addonId } })
  if (usageCount > 0) {
    await prisma.addon.update({ where: { id: addonId }, data: { active: false } })
  } else {
    await prisma.addon.delete({ where: { id: addonId } })
  }
  if (addon.serviceId) revalidatePath(`/admin/services/${addon.serviceId}`)
  revalidatePath("/services")
}
