"use server"

import { revalidatePath } from "next/cache"
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
