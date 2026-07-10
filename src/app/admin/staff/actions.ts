"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import bcrypt from "bcryptjs"
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

const staffSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Enter a valid email address").max(200),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  role: z.enum(["STAFF", "ADMIN"]),
})

export async function createStaff(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()

  const parsed = staffSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    role: formData.get("role"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const password = (formData.get("password") as string | null)?.trim()
  if (!password || password.length < 8) {
    return { status: "error", message: "Set a temporary password of at least 8 characters." }
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) {
    return { status: "error", message: "A user with that email already exists." }
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      role: parsed.data.role,
      passwordHash,
      emailVerified: new Date(),
    },
  })

  revalidatePath("/admin/staff")
  redirect("/admin/staff")
}

export async function updateStaff(
  staffId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const parsed = staffSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    role: formData.get("role"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const existing = await prisma.user.findFirst({
    where: { email: parsed.data.email, NOT: { id: staffId } },
  })
  if (existing) {
    return { status: "error", message: "A user with that email already exists." }
  }

  await prisma.user.update({
    where: { id: staffId },
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      role: parsed.data.role,
    },
  })

  revalidatePath("/admin/staff")
  redirect("/admin/staff")
}

export async function toggleStaffActive(staffId: string, active: boolean) {
  await requireAdmin()
  await prisma.user.update({ where: { id: staffId }, data: { active } })
  revalidatePath("/admin/staff")
}

export async function resetStaffPassword(
  staffId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const newPassword = (formData.get("newPassword") as string | null)?.trim()
  if (!newPassword || newPassword.length < 8) {
    return { status: "error", message: "Password must be at least 8 characters." }
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({ where: { id: staffId }, data: { passwordHash } })

  return { status: "idle", message: "Password reset." }
}
