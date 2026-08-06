"use server"

import { redirect } from "next/navigation"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"

export type ResetPasswordState = { status: "idle" | "error"; message?: string }

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
})

export async function resetPasswordWithToken(
  token: string,
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const parsed = resetPasswordSchema.safeParse({ password: formData.get("password") })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid password." }
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  })
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return { status: "error", message: "This reset link is invalid or has expired. Request a new one." }
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10)
  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
  ])

  await logAudit({
    actorId: resetToken.userId,
    action: "RESET_PASSWORD",
    entity: "User",
    entityId: resetToken.userId,
    meta: `${resetToken.user.name} <${resetToken.user.email}> — self-service password reset`,
  })

  redirect("/login?reset=success")
}
