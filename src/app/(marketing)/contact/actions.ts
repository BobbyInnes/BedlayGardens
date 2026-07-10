"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getSetting } from "@/lib/settings"
import { sendEmail } from "@/lib/email"

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Enter a valid email address").max(200),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  message: z.string().trim().min(1, "Message is required").max(4000),
})

export type ContactFormState = {
  status: "idle" | "success" | "error"
  message?: string
  fieldErrors?: Partial<Record<keyof z.infer<typeof contactSchema>, string>>
}

export async function submitContactForm(
  _prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    message: formData.get("message"),
  })

  if (!parsed.success) {
    const fieldErrors: ContactFormState["fieldErrors"] = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof z.infer<typeof contactSchema>
      fieldErrors[key] = issue.message
    }
    return { status: "error", fieldErrors, message: "Please fix the errors below." }
  }

  const { name, email, phone, message } = parsed.data

  await prisma.contactMessage.create({
    data: { name, email, phone: phone || null, message },
  })

  const adminEmail = await getSetting("business_email")
  if (adminEmail) {
    await sendEmail({
      to: adminEmail,
      subject: `New contact message from ${name}`,
      html: `<p><strong>Name:</strong> ${name}</p>
<p><strong>Email:</strong> ${email}</p>
<p><strong>Phone:</strong> ${phone || "—"}</p>
<p><strong>Message:</strong></p>
<p>${message.replace(/\n/g, "<br />")}</p>`,
    })
  }

  return { status: "success", message: "Thanks — we'll be in touch soon." }
}
