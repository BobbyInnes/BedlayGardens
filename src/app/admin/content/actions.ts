"use server"

import { revalidatePath } from "next/cache"
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

const faqSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(300),
  answer: z.string().trim().min(1, "Answer is required").max(2000),
  sortOrder: z.coerce.number().int().default(0),
})

export async function createFaq(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const parsed = faqSchema.safeParse({
    question: formData.get("question"),
    answer: formData.get("answer"),
    sortOrder: formData.get("sortOrder") || "0",
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  await prisma.faq.create({ data: parsed.data })

  revalidatePath("/admin/content")
  revalidatePath("/faqs")
  return { status: "idle" }
}

export async function updateFaq(
  faqId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const parsed = faqSchema.safeParse({
    question: formData.get("question"),
    answer: formData.get("answer"),
    sortOrder: formData.get("sortOrder") || "0",
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  await prisma.faq.update({ where: { id: faqId }, data: parsed.data })

  revalidatePath("/admin/content")
  revalidatePath("/faqs")
  return { status: "idle" }
}

export async function deleteFaq(faqId: string) {
  await requireAdmin()
  await prisma.faq.delete({ where: { id: faqId } })
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
  await requireAdmin()
  const parsed = testimonialSchema.safeParse({
    author: formData.get("author"),
    text: formData.get("text"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  await prisma.testimonial.create({ data: parsed.data })

  revalidatePath("/admin/content")
  revalidatePath("/")
  return { status: "idle" }
}

export async function updateTestimonial(
  testimonialId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const parsed = testimonialSchema.safeParse({
    author: formData.get("author"),
    text: formData.get("text"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  await prisma.testimonial.update({ where: { id: testimonialId }, data: parsed.data })

  revalidatePath("/admin/content")
  revalidatePath("/")
  return { status: "idle" }
}

export async function toggleTestimonialVisible(testimonialId: string, visible: boolean) {
  await requireAdmin()
  await prisma.testimonial.update({ where: { id: testimonialId }, data: { visible } })
  revalidatePath("/admin/content")
  revalidatePath("/")
}

export async function deleteTestimonial(testimonialId: string) {
  await requireAdmin()
  await prisma.testimonial.delete({ where: { id: testimonialId } })
  revalidatePath("/admin/content")
  revalidatePath("/")
}

// Homepage announcement banner (shown under the hero). Empty value = hidden.
export async function updateAnnouncementBanner(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const raw = ((formData.get("announcement_banner") as string | null) ?? "").trim()
  const value = raw ? sanitizeRichText(raw) : ""

  await prisma.setting.upsert({
    where: { key: "announcement_banner" },
    update: { value },
    create: { key: "announcement_banner", value },
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
  await requireAdmin()
  const raw = ((formData.get("about_banner") as string | null) ?? "").trim()
  const value = raw ? sanitizeRichText(raw) : ""

  await prisma.setting.upsert({
    where: { key: "about_banner" },
    update: { value },
    create: { key: "about_banner", value },
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
  await requireAdmin()
  const raw = ((formData.get("about_story") as string | null) ?? "").trim()
  const value = raw ? sanitizeRichText(raw) : ""

  await prisma.setting.upsert({
    where: { key: "about_story" },
    update: { value },
    create: { key: "about_story", value },
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
  await requireAdmin()
  const raw = ((formData.get("about_facility") as string | null) ?? "").trim()
  const value = raw ? sanitizeRichText(raw) : ""

  await prisma.setting.upsert({
    where: { key: "about_facility" },
    update: { value },
    create: { key: "about_facility", value },
  })

  revalidatePath("/admin/content")
  revalidatePath("/about")
  return { status: "idle", message: "Our facility updated." }
}

export async function updateOpeningHours(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const openingHours = ((formData.get("opening_hours") as string | null) ?? "").trim()

  await prisma.setting.upsert({
    where: { key: "opening_hours" },
    update: { value: openingHours },
    create: { key: "opening_hours", value: openingHours },
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

  revalidatePath("/admin/content")
  revalidatePath("/")
  revalidatePath("/contact")
  revalidatePath("/about")
  return { status: "idle", message: "Business email updated across the site." }
}

export async function updateGoogleReviewUrl(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const url = ((formData.get("google_business_review_url") as string | null) ?? "").trim()

  await prisma.setting.upsert({
    where: { key: "google_business_review_url" },
    update: { value: url },
    create: { key: "google_business_review_url", value: url },
  })

  revalidatePath("/admin/content")
  return { status: "idle", message: "Google review link updated." }
}

const agreementSchema = z.object({
  version: z.string().trim().min(1, "Version label is required").max(50),
  text: z.string().trim().min(1, "Agreement text is required").max(20000),
})

export async function publishAgreement(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const parsed = agreementSchema.safeParse({
    version: formData.get("version"),
    text: formData.get("text"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  await prisma.$transaction([
    prisma.agreement.updateMany({ where: { active: true }, data: { active: false } }),
    prisma.agreement.create({
      data: { version: parsed.data.version, text: parsed.data.text, active: true },
    }),
  ])

  revalidatePath("/admin/content")
  return { status: "idle", message: "New agreement version published — customers will be asked to re-sign." }
}
