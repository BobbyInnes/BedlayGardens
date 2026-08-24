"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"
import { getSettings } from "@/lib/settings"
import { sendEmail } from "@/lib/email"
import { EMAIL_TEMPLATE_DEFS, EMAIL_TEMPLATE_TYPES, type EmailTemplateType } from "@/lib/email-template-store"
import { previewBookingConfirmationInvoiceEmail, previewPaymentReceiptEmail } from "@/lib/email-templates"

export type EmailTemplateActionState = { status: "idle" | "error"; message?: string }

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }
  return session
}

function isValidType(type: string): type is EmailTemplateType {
  return (EMAIL_TEMPLATE_TYPES as readonly string[]).includes(type)
}

function renderPreview(type: EmailTemplateType, settings: Awaited<ReturnType<typeof getSettings>>, subject: string, bodyHtml: string) {
  return type === "PAYMENT_RECEIPT"
    ? previewPaymentReceiptEmail(settings, subject, bodyHtml)
    : previewBookingConfirmationInvoiceEmail(settings, subject, bodyHtml)
}

const templateSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required").max(300),
  bodyHtml: z.string().trim().min(1, "Body is required").max(20000),
})

export async function saveEmailTemplate(
  type: string,
  _prevState: EmailTemplateActionState,
  formData: FormData
): Promise<EmailTemplateActionState> {
  const session = await requireAdmin()
  if (!isValidType(type)) return { status: "error", message: "Unknown template type." }

  const parsed = templateSchema.safeParse({
    subject: formData.get("subject"),
    bodyHtml: formData.get("bodyHtml"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  await prisma.emailTemplate.upsert({
    where: { type },
    create: { type, subject: parsed.data.subject, bodyHtml: parsed.data.bodyHtml },
    update: { subject: parsed.data.subject, bodyHtml: parsed.data.bodyHtml },
  })

  await logAudit({
    actorId: session.user.id,
    action: "UPDATE_EMAIL_TEMPLATE",
    entity: "EmailTemplate",
    entityId: type,
    meta: `${EMAIL_TEMPLATE_DEFS[type].label} — subject: "${parsed.data.subject}"`,
  })

  revalidatePath("/admin/email-templates")
  return { status: "idle", message: "Saved." }
}

// No formData involved — bound to a plain button, not a text-input form —
// so this doesn't go through useActionState like saveEmailTemplate.
export async function resetEmailTemplate(type: string): Promise<void> {
  const session = await requireAdmin()
  if (!isValidType(type)) return

  const deleted = await prisma.emailTemplate.deleteMany({ where: { type } })
  if (deleted.count > 0) {
    await logAudit({
      actorId: session.user.id,
      action: "RESET_EMAIL_TEMPLATE",
      entity: "EmailTemplate",
      entityId: type,
      meta: `${EMAIL_TEMPLATE_DEFS[type].label} reset to default`,
    })
  }
  revalidatePath("/admin/email-templates")
}

// Renders whatever the admin currently has typed — including unsaved
// changes — against sample data. Called directly from the client editor
// (not via useActionState) since it's a "compute and show me" action, not a
// form submission with pass/fail state.
export async function previewEmailTemplate(
  type: string,
  subject: string,
  bodyHtml: string
): Promise<{ subject: string; html: string } | { error: string }> {
  await requireAdmin()
  if (!isValidType(type)) return { error: "Unknown template type." }
  const settings = await getSettings()
  return renderPreview(type, settings, subject, bodyHtml)
}

// Sends the currently-typed (possibly unsaved) template, rendered against
// sample data, to the admin's own account email — never an arbitrary
// address, so there's no risk of a draft template reaching a real customer.
export async function sendTestEmailTemplate(
  type: string,
  subject: string,
  bodyHtml: string
): Promise<{ status: "idle" | "error"; message?: string }> {
  const session = await requireAdmin()
  if (!isValidType(type)) return { status: "error", message: "Unknown template type." }
  if (!session.user.email) return { status: "error", message: "Your account has no email on file." }

  const settings = await getSettings()
  const rendered = renderPreview(type, settings, subject, bodyHtml)
  await sendEmail({ to: session.user.email, subject: `[TEST] ${rendered.subject}`, html: rendered.html })
  return { status: "idle", message: `Test email sent to ${session.user.email}.` }
}
