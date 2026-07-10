"use server"

import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { signIn } from "@/auth"

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Enter a valid email address").max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
})

export type RegisterState = {
  status: "idle" | "error"
  message?: string
  fieldErrors?: Partial<Record<"name" | "email" | "password", string>>
}

export async function registerAction(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    const fieldErrors: RegisterState["fieldErrors"] = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as "name" | "email" | "password"
      fieldErrors[key] = issue.message
    }
    return { status: "error", fieldErrors, message: "Please fix the errors below." }
  }

  const { name, email, password } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return {
      status: "error",
      fieldErrors: { email: "An account with this email already exists." },
    }
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.user.create({
    data: { name, email, passwordHash, role: "CUSTOMER" },
  })

  await signIn("credentials", { email, password, redirectTo: "/portal" })

  return { status: "idle" }
}
