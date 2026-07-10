"use server"

import { randomUUID } from "node:crypto"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { auth, signOut } from "@/auth"
import { prisma } from "@/lib/prisma"

export type ActionState = { status: "idle" | "success" | "error"; message?: string }

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
})

export async function updateProfile(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Unauthorized" }

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    address: formData.get("address"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
    },
  })

  return { status: "success", message: "Details updated." }
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
  })

export async function changePassword(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Unauthorized" }

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user?.passwordHash) {
    return { status: "error", message: "This account has no password set." }
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)
  if (!valid) {
    return { status: "error", message: "Current password is incorrect." }
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 10)
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } })

  return { status: "success", message: "Password updated." }
}

export async function deleteAccount() {
  const session = await auth()
  if (!session?.user) return

  try {
    await prisma.user.delete({ where: { id: session.user.id } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          name: "Deleted user",
          email: `deleted-${randomUUID()}@bedlaygardens.invalid`,
          passwordHash: null,
          phone: null,
          address: null,
          active: false,
        },
      })
    } else {
      throw error
    }
  }

  await signOut({ redirectTo: "/" })
}
