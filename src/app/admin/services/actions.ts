"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sanitizeRichText } from "@/lib/sanitize-html"
import { logAudit, diffFields } from "@/lib/audit"
import { formatPence } from "@/lib/format"

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
  const session = await requireAdmin()
  const parsed = readServiceFields(formData)
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const existing = await prisma.service.findUnique({ where: { slug: parsed.data.slug } })
  if (existing) {
    return { status: "error", message: "A service with that slug already exists." }
  }

  const service = await prisma.service.create({
    data: { ...parsed.data, description: sanitizeRichText(parsed.data.description) },
  })
  await logAudit({
    actorId: session.user.id,
    action: "CREATE_SERVICE",
    entity: "Service",
    entityId: service.id,
    meta: `${parsed.data.name} (${parsed.data.slug})`,
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
  const session = await requireAdmin()
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

  const before = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!before) {
    return { status: "error", message: "Service not found." }
  }
  const newDescription = sanitizeRichText(parsed.data.description)

  await prisma.service.update({
    where: { id: serviceId },
    data: { ...parsed.data, description: newDescription },
  })

  // Description is rich text (HTML), so it's flagged as changed rather than
  // diffed field-by-field alongside the other, short scalar fields below —
  // dumping the full before/after HTML into the audit log's Detail column
  // would swamp the more useful summary.
  const fieldDiff = diffFields(
    {
      name: before.name,
      slug: before.slug,
      pricingModel: before.pricingModel,
      basePricePence: formatPence(before.basePricePence),
      halfDayPricePence: before.halfDayPricePence != null ? formatPence(before.halfDayPricePence) : null,
      paymentTiming: before.paymentTiming,
      sortOrder: before.sortOrder,
      requiresTrial: before.requiresTrial,
    },
    {
      name: parsed.data.name,
      slug: parsed.data.slug,
      pricingModel: parsed.data.pricingModel,
      basePricePence: formatPence(parsed.data.basePricePence),
      halfDayPricePence:
        parsed.data.halfDayPricePence != null ? formatPence(parsed.data.halfDayPricePence) : null,
      paymentTiming: parsed.data.paymentTiming,
      sortOrder: parsed.data.sortOrder,
      requiresTrial: parsed.data.requiresTrial,
    },
    {
      name: "Name",
      slug: "Slug",
      pricingModel: "Pricing model",
      basePricePence: "Base price",
      halfDayPricePence: "Half-day price",
      paymentTiming: "Payment timing",
      sortOrder: "Sort order",
      requiresTrial: "Requires trial",
    }
  )
  const descriptionNote = newDescription !== before.description ? "Description: changed" : null
  const diff = [fieldDiff, descriptionNote].filter(Boolean).join("; ")

  await logAudit({
    actorId: session.user.id,
    action: "UPDATE_SERVICE",
    entity: "Service",
    entityId: serviceId,
    meta: `${parsed.data.name} (${parsed.data.slug}) — ${diff || "no changes"}`,
  })
  revalidatePath("/admin/services")
  revalidatePath("/services")
  revalidatePath("/book")
  redirect("/admin/services")
}

export async function toggleServiceActive(serviceId: string, active: boolean) {
  const session = await requireAdmin()
  const service = await prisma.service.update({ where: { id: serviceId }, data: { active } })
  await logAudit({
    actorId: session.user.id,
    action: "TOGGLE_SERVICE_ACTIVE",
    entity: "Service",
    entityId: serviceId,
    meta: `${service.name} — ${active ? "activated" : "deactivated"}`,
  })
  revalidatePath("/admin/services")
  revalidatePath("/services")
  revalidatePath("/book")
}

export async function deleteService(serviceId: string) {
  const session = await requireAdmin()
  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  const bookingCount = await prisma.booking.count({ where: { serviceId } })

  if (bookingCount > 0) {
    await prisma.service.update({ where: { id: serviceId }, data: { active: false } })
    await logAudit({
      actorId: session.user.id,
      action: "DEACTIVATE_SERVICE",
      entity: "Service",
      entityId: serviceId,
      meta: `${service?.name ?? serviceId} — deactivated instead of deleted (${bookingCount} existing bookings)`,
    })
  } else {
    await prisma.service.delete({ where: { id: serviceId } })
    await logAudit({
      actorId: session.user.id,
      action: "DELETE_SERVICE",
      entity: "Service",
      entityId: serviceId,
      meta: service?.name ?? serviceId,
    })
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
  const session = await requireAdmin()
  const parsed = addonSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    pricePence: formData.get("pricePence"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const addon = await prisma.addon.create({
    data: {
      serviceId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      pricePence: parsed.data.pricePence,
    },
  })
  await logAudit({
    actorId: session.user.id,
    action: "CREATE_ADDON",
    entity: "Addon",
    entityId: addon.id,
    meta: `${parsed.data.name} — £${(parsed.data.pricePence / 100).toFixed(2)}`,
  })
  revalidatePath(`/admin/services/${serviceId}`)
  revalidatePath("/services")
  return { status: "idle" }
}

export async function toggleAddonActive(addonId: string, active: boolean) {
  const session = await requireAdmin()
  const addon = await prisma.addon.update({ where: { id: addonId }, data: { active } })
  await logAudit({
    actorId: session.user.id,
    action: "TOGGLE_ADDON_ACTIVE",
    entity: "Addon",
    entityId: addonId,
    meta: `${addon.name} — ${active ? "activated" : "deactivated"}`,
  })
  revalidatePath(`/admin/services/${addon.serviceId}`)
  revalidatePath("/services")
}

export async function deleteAddon(addonId: string) {
  const session = await requireAdmin()
  const addon = await prisma.addon.findUnique({ where: { id: addonId } })
  if (!addon) return
  const usageCount = await prisma.bookingAddon.count({ where: { addonId } })
  if (usageCount > 0) {
    await prisma.addon.update({ where: { id: addonId }, data: { active: false } })
    await logAudit({
      actorId: session.user.id,
      action: "DEACTIVATE_ADDON",
      entity: "Addon",
      entityId: addonId,
      meta: `${addon.name} — deactivated instead of deleted (used in ${usageCount} bookings)`,
    })
  } else {
    await prisma.addon.delete({ where: { id: addonId } })
    await logAudit({
      actorId: session.user.id,
      action: "DELETE_ADDON",
      entity: "Addon",
      entityId: addonId,
      meta: addon.name,
    })
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
  const session = await requireAdmin()
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

  const rule = await prisma.priceRule.create({
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
  await logAudit({
    actorId: session.user.id,
    action: "CREATE_PRICE_RULE",
    entity: "PriceRule",
    entityId: rule.id,
    meta: `${parsed.data.label}: ${parsed.data.startDate} → ${parsed.data.endDate}, ${
      parsed.data.priceType === "multiplier"
        ? `×${parsed.data.multiplier}`
        : `override £${((parsed.data.overridePricePence ?? 0) / 100).toFixed(2)}`
    }`,
  })
  revalidatePath(`/admin/services/${serviceId}`)
  return { status: "idle" }
}

export async function deletePriceRule(priceRuleId: string) {
  const session = await requireAdmin()
  const rule = await prisma.priceRule.findUnique({ where: { id: priceRuleId } })
  if (!rule) return
  await prisma.priceRule.delete({ where: { id: priceRuleId } })
  await logAudit({
    actorId: session.user.id,
    action: "DELETE_PRICE_RULE",
    entity: "PriceRule",
    entityId: priceRuleId,
    meta: rule.label,
  })
  revalidatePath(`/admin/services/${rule.serviceId}`)
}
