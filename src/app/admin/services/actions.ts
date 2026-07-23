"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sanitizeRichText } from "@/lib/sanitize-html"

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
  description: z.string().trim().min(1, "Description is required").max(4000),
  pricingModel: z.enum(["PER_NIGHT", "PER_DAY", "PER_SESSION"]),
  basePricePence: z.coerce.number().int().min(0),
  halfDayPricePence: z.coerce.number().int().min(0).optional().nullable(),
  paymentTiming: z.enum(["FULL_UPFRONT", "DEPOSIT_THEN_BALANCE", "INVOICE_AFTER"]),
  sortOrder: z.coerce.number().int().default(0),
  requiresTrial: z.boolean().default(false),
})

function readServiceFields(formData: FormData) {
  return serviceSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    pricingModel: formData.get("pricingModel"),
    basePricePence: formData.get("basePricePence"),
    halfDayPricePence: formData.get("halfDayPricePence") || undefined,
    paymentTiming: formData.get("paymentTiming"),
    sortOrder: formData.get("sortOrder") || "0",
    requiresTrial: formData.get("requiresTrial") === "on",
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

  await prisma.service.create({
    data: { ...parsed.data, description: sanitizeRichText(parsed.data.description) },
  })
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

  await prisma.service.update({
    where: { id: serviceId },
    data: { ...parsed.data, description: sanitizeRichText(parsed.data.description) },
  })
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

const priceRuleSchema = z
  .object({
    label: z.string().trim().min(1, "Label is required").max(200),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    priceType: z.enum(["multiplier", "override"]),
    multiplier: z.coerce.number().positive().optional(),
    overridePricePence: z.coerce.number().int().min(0).optional(),
    minNights: z.coerce.number().int().min(1).optional(),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  })

export async function createPriceRule(
  serviceId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const parsed = priceRuleSchema.safeParse({
    label: formData.get("label"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    priceType: formData.get("priceType"),
    multiplier: formData.get("multiplier") || undefined,
    overridePricePence: formData.get("overridePricePence") || undefined,
    minNights: formData.get("minNights") || undefined,
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  if (parsed.data.priceType === "multiplier" && !parsed.data.multiplier) {
    return { status: "error", message: "Enter a multiplier (e.g. 1.25 for +25%)." }
  }
  if (parsed.data.priceType === "override" && parsed.data.overridePricePence == null) {
    return { status: "error", message: "Enter an override price." }
  }

  await prisma.priceRule.create({
    data: {
      serviceId,
      label: parsed.data.label,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      multiplier: parsed.data.priceType === "multiplier" ? parsed.data.multiplier : null,
      overridePricePence: parsed.data.priceType === "override" ? parsed.data.overridePricePence : null,
      minNights: parsed.data.minNights ?? null,
    },
  })
  revalidatePath(`/admin/services/${serviceId}`)
  return { status: "idle" }
}

export async function deletePriceRule(priceRuleId: string) {
  await requireAdmin()
  const rule = await prisma.priceRule.findUnique({ where: { id: priceRuleId } })
  if (!rule) return
  await prisma.priceRule.delete({ where: { id: priceRuleId } })
  revalidatePath(`/admin/services/${rule.serviceId}`)
}
