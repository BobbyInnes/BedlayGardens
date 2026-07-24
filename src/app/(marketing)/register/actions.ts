"use server"

import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { signIn } from "@/auth"

const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200),
    email: z.string().trim().email("Enter a valid email address").max(200),
    password: z.string().min(8, "Password must be at least 8 characters").max(200),
    phone: z.string().trim().max(50).optional().or(z.literal("")),
    workPhone: z.string().trim().max(50).optional().or(z.literal("")),
    addressLine1: z.string().trim().min(1, "Address line 1 is required").max(200),
    addressLine2: z.string().trim().max(200).optional().or(z.literal("")),
    addressCity: z.string().trim().max(100).optional().or(z.literal("")),
    addressPostcode: z.string().trim().max(20).optional().or(z.literal("")),
  })
  .refine((data) => !!data.phone || !!data.workPhone, {
    message: "Enter a telephone number or a work phone number.",
    path: ["phone"],
  })

export type RegisterState = {
  status: "idle" | "error"
  message?: string
  fieldErrors?: Partial<
    Record<
      | "name"
      | "email"
      | "password"
      | "phone"
      | "workPhone"
      | "addressLine1"
      | "addressLine2"
      | "addressCity"
      | "addressPostcode",
      string
    >
  >
}

export async function registerAction(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone"),
    workPhone: formData.get("workPhone"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2"),
    addressCity: formData.get("addressCity"),
    addressPostcode: formData.get("addressPostcode"),
  })

  if (!parsed.success) {
    const fieldErrors: RegisterState["fieldErrors"] = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<RegisterState["fieldErrors"]>
      fieldErrors[key] = issue.message
    }
    return { status: "error", fieldErrors, message: "Please fix the errors below." }
  }

  const { name, email, password, phone, workPhone, addressLine1, addressLine2, addressCity, addressPostcode } =
    parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return {
      status: "error",
      fieldErrors: { email: "An account with this email already exists." },
    }
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "CUSTOMER",
      phone: phone || null,
      workPhone: workPhone || null,
      addressLine1,
      addressLine2: addressLine2 || null,
      addressCity: addressCity || null,
      addressPostcode: addressPostcode || null,
    },
  })

  await signIn("credentials", { email, password, redirectTo: "/portal" })

  return { status: "idle" }
}
