"use server"

import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"
import { signIn } from "@/auth"
import { getSettings } from "@/lib/settings"
import { getSiteUrl } from "@/lib/stripe"
import { sendEmail } from "@/lib/email"
import { welcomeEmail } from "@/lib/email-templates"
import { fullName } from "@/lib/format"
import { SALUTATIONS } from "@/lib/salutations"
import { setOptOut, setPetCareUpdatesPreference } from "@/lib/notification-preferences"

const registerSchema = z
  .object({
    salutation: z.enum(SALUTATIONS).optional().or(z.literal("")),
    forename: z.string().trim().min(1, "Forename is required").max(100),
    surname: z.string().trim().min(1, "Surname is required").max(100),
    email: z.string().trim().email("Enter a valid email address").max(200),
    password: z.string().min(8, "Password must be at least 8 characters").max(200),
    homePhone: z.string().trim().max(50).optional().or(z.literal("")),
    phone: z.string().trim().max(50).optional().or(z.literal("")),
    workPhone: z.string().trim().max(50).optional().or(z.literal("")),
    addressLine1: z.string().trim().min(1, "Address line 1 is required").max(200),
    addressLine2: z.string().trim().max(200).optional().or(z.literal("")),
    addressCity: z.string().trim().max(100).optional().or(z.literal("")),
    addressPostcode: z.string().trim().max(20).optional().or(z.literal("")),
  })
  .refine((data) => !!data.homePhone || !!data.phone || !!data.workPhone, {
    message: "Enter at least one phone number (Home, Mobile, or Works).",
    path: ["phone"],
  })

type RegisterFieldValues = {
  salutation: string
  forename: string
  surname: string
  email: string
  homePhone: string
  phone: string
  workPhone: string
  addressLine1: string
  addressLine2: string
  addressCity: string
  addressPostcode: string
  notifyPetCareEmail: boolean
  notifyMarketingEmail: boolean
  notifyPetCareSms: boolean
}

export type RegisterState = {
  status: "idle" | "error"
  message?: string
  fieldErrors?: Partial<
    Record<
      | "salutation"
      | "forename"
      | "surname"
      | "email"
      | "password"
      | "homePhone"
      | "phone"
      | "workPhone"
      | "addressLine1"
      | "addressLine2"
      | "addressCity"
      | "addressPostcode",
      string
    >
  >
  // Echoed back on error (password excluded) so the customer never has to
  // retype the whole form to fix one field, e.g. a duplicate email address.
  values?: RegisterFieldValues
}

export async function registerAction(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const values: RegisterFieldValues = {
    salutation: String(formData.get("salutation") ?? ""),
    forename: String(formData.get("forename") ?? ""),
    surname: String(formData.get("surname") ?? ""),
    email: String(formData.get("email") ?? ""),
    homePhone: String(formData.get("homePhone") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    workPhone: String(formData.get("workPhone") ?? ""),
    addressLine1: String(formData.get("addressLine1") ?? ""),
    addressLine2: String(formData.get("addressLine2") ?? ""),
    addressCity: String(formData.get("addressCity") ?? ""),
    addressPostcode: String(formData.get("addressPostcode") ?? ""),
    // Notification-settings toggles aren't part of registerSchema below —
    // they're plain on/off switches with nothing to validate, same
    // convention as other boolean form fields in this codebase (e.g.
    // isSuperAdmin in staff/team/actions.ts): read directly as
    // formData.get(name) === "on".
    notifyPetCareEmail: formData.get("notifyPetCareEmail") === "on",
    notifyMarketingEmail: formData.get("notifyMarketingEmail") === "on",
    notifyPetCareSms: formData.get("notifyPetCareSms") === "on",
  }

  const parsed = registerSchema.safeParse({
    ...values,
    password: formData.get("password"),
  })

  if (!parsed.success) {
    const fieldErrors: RegisterState["fieldErrors"] = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<RegisterState["fieldErrors"]>
      fieldErrors[key] = issue.message
    }
    return { status: "error", fieldErrors, message: "Please fix the errors below.", values }
  }

  const {
    salutation,
    forename,
    surname,
    email,
    password,
    homePhone,
    phone,
    workPhone,
    addressLine1,
    addressLine2,
    addressCity,
    addressPostcode,
  } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return {
      status: "error",
      fieldErrors: { email: "An account with this email already exists." },
      values,
    }
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: {
      salutation: salutation || null,
      forename,
      surname,
      email,
      passwordHash,
      role: "CUSTOMER",
      homePhone: homePhone || null,
      phone: phone || null,
      workPhone: workPhone || null,
      addressLine1,
      addressLine2: addressLine2 || null,
      addressCity: addressCity || null,
      addressPostcode: addressPostcode || null,
    },
  })

  await logAudit({
    actorId: user.id,
    action: "CREATE_CUSTOMER",
    entity: "User",
    entityId: user.id,
    meta: `${fullName(user)} <${user.email}> — self-registered`,
  })

  // Only write a NotificationPreference row when the customer deviated from
  // the defaults (Pet Care Updates + Marketing Emails on by email, SMS off)
  // — matches every existing customer's implicit default, so an untouched
  // account doesn't need a row at all.
  if (!values.notifyPetCareEmail) await setPetCareUpdatesPreference(user.id, "email", false)
  if (values.notifyPetCareSms) await setPetCareUpdatesPreference(user.id, "sms", true)
  if (!values.notifyMarketingEmail) await setOptOut(user.id, "ABANDONED_BOOKING_REMINDER", true)

  // A failed welcome email must not fail the registration itself.
  try {
    const settings = await getSettings()
    const welcome = welcomeEmail(settings, user, `${getSiteUrl()}/portal/dogs/new`)
    await sendEmail({ to: email, subject: welcome.subject, html: welcome.html })
  } catch (error) {
    console.error("[register] failed to send welcome email", error)
  }

  await signIn("credentials", { email, password, redirectTo: "/portal" })

  return { status: "idle" }
}
