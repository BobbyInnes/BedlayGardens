"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sanitizeRichText, htmlToPlainText } from "@/lib/sanitize-html"
import { NAV_LINKS, navSettingKey } from "@/lib/nav-links"
import { logAudit } from "@/lib/audit"

export type AdminActionState = { status: "idle" | "error"; message?: string }

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }
  return session
}

// Short plain-text preview for audit log meta — rich text HTML would be
// noisy and largely unreadable in a log list.
function previewText(value: string, maxLength = 150): string {
  const plain = htmlToPlainText(value)
  return plain.length > maxLength ? `${plain.slice(0, maxLength)}…` : plain
}

const faqSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(300),
  answer: z.string().trim().min(1, "Answer is required").max(2000),
  sortOrder: z.coerce.number().int().default(0),
})

export async function createFaq(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const parsed = faqSchema.safeParse({
    question: formData.get("question"),
    answer: formData.get("answer"),
    sortOrder: formData.get("sortOrder") || "0",
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const faq = await prisma.faq.create({ data: parsed.data })
  await logAudit({
    actorId: session.user.id,
    action: "CREATE_FAQ",
    entity: "Faq",
    entityId: faq.id,
    meta: parsed.data.question,
  })

  revalidatePath("/admin/content")
  revalidatePath("/faqs")
  return { status: "idle" }
}

export async function updateFaq(
  faqId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const parsed = faqSchema.safeParse({
    question: formData.get("question"),
    answer: formData.get("answer"),
    sortOrder: formData.get("sortOrder") || "0",
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  await prisma.faq.update({ where: { id: faqId }, data: parsed.data })
  await logAudit({
    actorId: session.user.id,
    action: "UPDATE_FAQ",
    entity: "Faq",
    entityId: faqId,
    meta: parsed.data.question,
  })

  revalidatePath("/admin/content")
  revalidatePath("/faqs")
  return { status: "idle" }
}

export async function deleteFaq(faqId: string) {
  const session = await requireAdmin()
  const faq = await prisma.faq.delete({ where: { id: faqId } })
  await logAudit({
    actorId: session.user.id,
    action: "DELETE_FAQ",
    entity: "Faq",
    entityId: faqId,
    meta: faq.question,
  })
  revalidatePath("/admin/content")
  revalidatePath("/faqs")
}

const testimonialSchema = z.object({
  author: z.string().trim().min(1, "Author is required").max(200),
  text: z.string().trim().min(1, "Testimonial text is required").max(1000),
})

export async function createTestimonial(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const parsed = testimonialSchema.safeParse({
    author: formData.get("author"),
    text: formData.get("text"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const testimonial = await prisma.testimonial.create({ data: parsed.data })
  await logAudit({
    actorId: session.user.id,
    action: "CREATE_TESTIMONIAL",
    entity: "Testimonial",
    entityId: testimonial.id,
    meta: parsed.data.author,
  })

  revalidatePath("/admin/content")
  revalidatePath("/")
  return { status: "idle" }
}

export async function updateTestimonial(
  testimonialId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const parsed = testimonialSchema.safeParse({
    author: formData.get("author"),
    text: formData.get("text"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  await prisma.testimonial.update({ where: { id: testimonialId }, data: parsed.data })
  await logAudit({
    actorId: session.user.id,
    action: "UPDATE_TESTIMONIAL",
    entity: "Testimonial",
    entityId: testimonialId,
    meta: parsed.data.author,
  })

  revalidatePath("/admin/content")
  revalidatePath("/")
  return { status: "idle" }
}

export async function toggleTestimonialVisible(testimonialId: string, visible: boolean) {
  const session = await requireAdmin()
  await prisma.testimonial.update({ where: { id: testimonialId }, data: { visible } })
  await logAudit({
    actorId: session.user.id,
    action: "TOGGLE_TESTIMONIAL_VISIBLE",
    entity: "Testimonial",
    entityId: testimonialId,
    meta: visible ? "shown" : "hidden",
  })
  revalidatePath("/admin/content")
  revalidatePath("/")
}

export async function deleteTestimonial(testimonialId: string) {
  const session = await requireAdmin()
  const testimonial = await prisma.testimonial.delete({ where: { id: testimonialId } })
  await logAudit({
    actorId: session.user.id,
    action: "DELETE_TESTIMONIAL",
    entity: "Testimonial",
    entityId: testimonialId,
    meta: testimonial.author,
  })
  revalidatePath("/admin/content")
  revalidatePath("/")
}

// Homepage announcement banner (shown under the hero). Empty value = hidden.
export async function updateAnnouncementBanner(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const raw = ((formData.get("announcement_banner") as string | null) ?? "").trim()
  const value = raw ? sanitizeRichText(raw) : ""

  await prisma.setting.upsert({
    where: { key: "announcement_banner" },
    update: { value },
    create: { key: "announcement_banner", value },
  })
  await logAudit({
    actorId: session.user.id,
    action: "UPDATE_SETTING",
    entity: "Setting",
    entityId: "announcement_banner",
    meta: value ? previewText(value) : "cleared (hidden)",
  })

  revalidatePath("/admin/content")
  revalidatePath("/")
  return {
    status: "idle",
    message: value ? "Announcement banner updated." : "Announcement banner hidden.",
  }
}

// About page banner (shown at the top of the About Us page). Empty value = hidden.
export async function updateAboutBanner(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const raw = ((formData.get("about_banner") as string | null) ?? "").trim()
  const value = raw ? sanitizeRichText(raw) : ""

  await prisma.setting.upsert({
    where: { key: "about_banner" },
    update: { value },
    create: { key: "about_banner", value },
  })
  await logAudit({
    actorId: session.user.id,
    action: "UPDATE_SETTING",
    entity: "Setting",
    entityId: "about_banner",
    meta: value ? previewText(value) : "cleared (hidden)",
  })

  revalidatePath("/admin/content")
  revalidatePath("/about")
  return {
    status: "idle",
    message: value ? "About page banner updated." : "About page banner hidden.",
  }
}

// About Us "Our story" section copy. Empty value falls back to the default.
export async function updateAboutStory(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const raw = ((formData.get("about_story") as string | null) ?? "").trim()
  const value = raw ? sanitizeRichText(raw) : ""

  await prisma.setting.upsert({
    where: { key: "about_story" },
    update: { value },
    create: { key: "about_story", value },
  })
  await logAudit({
    actorId: session.user.id,
    action: "UPDATE_SETTING",
    entity: "Setting",
    entityId: "about_story",
    meta: value ? previewText(value) : "cleared (using default text)",
  })

  revalidatePath("/admin/content")
  revalidatePath("/about")
  return { status: "idle", message: "Our story updated." }
}

// About Us "Our facility" section copy. Empty value falls back to the default.
export async function updateAboutFacility(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const raw = ((formData.get("about_facility") as string | null) ?? "").trim()
  const value = raw ? sanitizeRichText(raw) : ""

  await prisma.setting.upsert({
    where: { key: "about_facility" },
    update: { value },
    create: { key: "about_facility", value },
  })
  await logAudit({
    actorId: session.user.id,
    action: "UPDATE_SETTING",
    entity: "Setting",
    entityId: "about_facility",
    meta: value ? previewText(value) : "cleared (using default text)",
  })

  revalidatePath("/admin/content")
  revalidatePath("/about")
  return { status: "idle", message: "Our facility updated." }
}

// /legal/terms page copy. Empty value falls back to the default placeholder text.
export async function updateTermsConditions(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const raw = ((formData.get("terms_conditions") as string | null) ?? "").trim()
  const value = raw ? sanitizeRichText(raw) : ""

  await prisma.setting.upsert({
    where: { key: "terms_conditions" },
    update: { value },
    create: { key: "terms_conditions", value },
  })
  await logAudit({
    actorId: session.user.id,
    action: "UPDATE_SETTING",
    entity: "Setting",
    entityId: "terms_conditions",
    meta: value ? previewText(value) : "cleared (using default placeholder)",
  })

  revalidatePath("/admin/content")
  revalidatePath("/legal/terms")
  return { status: "idle", message: "Terms & Conditions updated." }
}

// /vacancies page copy. Empty value means "no current vacancies" on the public page.
export async function updateVacancies(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const raw = ((formData.get("vacancies") as string | null) ?? "").trim()
  const value = raw ? sanitizeRichText(raw) : ""

  await prisma.setting.upsert({
    where: { key: "vacancies" },
    update: { value },
    create: { key: "vacancies", value },
  })
  await logAudit({
    actorId: session.user.id,
    action: "UPDATE_SETTING",
    entity: "Setting",
    entityId: "vacancies",
    meta: value ? previewText(value) : "cleared (no current vacancies)",
  })

  revalidatePath("/admin/content")
  revalidatePath("/vacancies")
  return { status: "idle", message: "Vacancies updated." }
}

// Main menu item visibility (Home/Services/Gallery/etc.) — a checked box
// means "on", an absent setting also means "on" (see navSettingKey), so a box
// only needs writing when it's unchecked.
export async function updateNavVisibility(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()

  const hidden: string[] = []
  await Promise.all(
    NAV_LINKS.map((link) => {
      const isOn = formData.get(link.key) === "on"
      if (!isOn) hidden.push(link.label)
      const value = isOn ? "true" : "false"
      const key = navSettingKey(link.key)
      return prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    })
  )
  await logAudit({
    actorId: session.user.id,
    action: "UPDATE_NAV_VISIBILITY",
    entity: "Setting",
    entityId: "nav_visibility",
    meta: hidden.length > 0 ? `hidden: ${hidden.join(", ")}` : "all menu items visible",
  })

  revalidatePath("/admin/content")
  // Nav links render in the shared marketing layout, not the "/" page itself
  // — revalidating "/" alone wouldn't touch that layout's cache, so every
  // other route would keep showing the stale menu.
  revalidatePath("/", "layout")
  return { status: "idle", message: "Main menu updated." }
}

export async function updateOpeningHours(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const openingHours = ((formData.get("opening_hours") as string | null) ?? "").trim()

  await prisma.setting.upsert({
    where: { key: "opening_hours" },
    update: { value: openingHours },
    create: { key: "opening_hours", value: openingHours },
  })
  await logAudit({
    actorId: session.user.id,
    action: "UPDATE_SETTING",
    entity: "Setting",
    entityId: "opening_hours",
    meta: openingHours || "cleared",
  })

  revalidatePath("/admin/content")
  revalidatePath("/")
  revalidatePath("/contact")
  return { status: "idle", message: "Opening hours updated." }
}

// The business email is the address shown on the contact page and footer,
// the recipient for contact-form and admin notification emails, and the
// address in outgoing email footers. Only super admins may change it.
export async function updateBusinessEmail(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  if (!session.user.isSuperAdmin) {
    return { status: "error", message: "Only a super admin can change the business email." }
  }

  const parsed = z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(200)
    .safeParse(formData.get("business_email"))
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid email" }
  }

  await prisma.setting.upsert({
    where: { key: "business_email" },
    update: { value: parsed.data },
    create: { key: "business_email", value: parsed.data },
  })
  await logAudit({
    actorId: session.user.id,
    action: "UPDATE_SETTING",
    entity: "Setting",
    entityId: "business_email",
    meta: parsed.data,
  })

  revalidatePath("/admin/content")
  revalidatePath("/")
  revalidatePath("/contact")
  revalidatePath("/about")
  return { status: "idle", message: "Business email updated across the site." }
}

// Recipient for the daily "vaccination certificates awaiting review" digest
// (see api/cron/send-reminders) — deliberately separate from business_email
// so this can be routed to whoever actually handles vaccination review
// without also changing the site's public contact address.
export async function updateVaccinationReviewEmail(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()

  const raw = ((formData.get("vaccination_review_email") as string | null) ?? "").trim()
  if (raw) {
    const parsed = z.string().email("Enter a valid email address").safeParse(raw)
    if (!parsed.success) {
      return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid email" }
    }
  }
  const immediate = formData.get("vaccination_review_immediate") === "on" ? "true" : "false"

  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: "vaccination_review_email" },
      update: { value: raw },
      create: { key: "vaccination_review_email", value: raw },
    }),
    prisma.setting.upsert({
      where: { key: "vaccination_review_immediate" },
      update: { value: immediate },
      create: { key: "vaccination_review_immediate", value: immediate },
    }),
  ])
  await logAudit({
    actorId: session.user.id,
    action: "UPDATE_SETTING",
    entity: "Setting",
    entityId: "vaccination_review_email",
    meta: `${raw || "(cleared)"} — ${immediate === "true" ? "sends immediately per upload" : "sends as a daily digest"}`,
  })

  revalidatePath("/admin/content")
  return { status: "idle", message: raw ? "Notification settings saved." : "Notification email cleared." }
}

export async function updateGoogleReviewUrl(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const url = ((formData.get("google_business_review_url") as string | null) ?? "").trim()

  await prisma.setting.upsert({
    where: { key: "google_business_review_url" },
    update: { value: url },
    create: { key: "google_business_review_url", value: url },
  })
  await logAudit({
    actorId: session.user.id,
    action: "UPDATE_SETTING",
    entity: "Setting",
    entityId: "google_business_review_url",
    meta: url || "cleared",
  })

  revalidatePath("/admin/content")
  return { status: "idle", message: "Google review link updated." }
}

const vatSettingsSchema = z.object({
  vat_number: z.string().trim().max(50),
  vat_rate_percent: z.coerce.number().min(0).max(100),
  vat_period_start_month: z.coerce.number().int().min(1).max(12),
  vat_period_length: z.enum(["MONTHLY", "QUARTERLY", "ANNUALLY"]),
})

export async function updateVatSettings(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const parsed = vatSettingsSchema.safeParse({
    vat_number: formData.get("vat_number"),
    vat_rate_percent: formData.get("vat_rate_percent"),
    vat_period_start_month: formData.get("vat_period_start_month"),
    vat_period_length: formData.get("vat_period_length"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid submission." }
  }

  const entries = Object.entries(parsed.data) as [string, string | number][]
  for (const [key, value] of entries) {
    await prisma.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    })
  }
  await logAudit({
    actorId: session.user.id,
    action: "UPDATE_SETTING",
    entity: "Setting",
    entityId: "vat_details",
    meta: `${parsed.data.vat_number || "no VAT number"} — ${parsed.data.vat_rate_percent}% — ${parsed.data.vat_period_length} from month ${parsed.data.vat_period_start_month}`,
  })

  revalidatePath("/admin/content")
  revalidatePath("/admin/accounting")
  return { status: "idle", message: "VAT details updated." }
}
