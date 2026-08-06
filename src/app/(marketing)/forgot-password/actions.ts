"use server"

import crypto from "node:crypto"
import { prisma } from "@/lib/prisma"
import { getSettings } from "@/lib/settings"
import { getSiteUrl } from "@/lib/stripe"
import { sendEmail } from "@/lib/email"
import { passwordResetEmail } from "@/lib/email-templates"

export type ForgotPasswordState = { status: "idle" | "success" | "error"; message?: string }

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

// Always the same response whether or not the email matches an account —
// confirming/denying that would let someone enumerate registered emails.
const GENERIC_MESSAGE = "If an account exists for that email, we've sent a link to reset the password."

export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
  if (!email) {
    return { status: "error", message: "Enter your email address." }
  }

  const user = await prisma.user.findUnique({ where: { email } })
  // Works for any account regardless of whether it already has a password
  // set — that also covers an account that's only ever signed in via magic
  // link, letting it pick up a password for the first time this way.
  if (user) {
    // Drop any earlier unused tokens so only the most recent link works.
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } })
    const token = crypto.randomBytes(32).toString("hex")
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    })

    // A failed email must not reveal to the caller whether the account
    // exists, so this is best-effort like every other notification email.
    try {
      const settings = await getSettings()
      const resetUrl = `${getSiteUrl()}/reset-password/${token}`
      const email_ = passwordResetEmail(settings, resetUrl)
      await sendEmail({ to: user.email, subject: email_.subject, html: email_.html })
    } catch (error) {
      console.error("[forgot-password] failed to send reset email", error)
    }
  }

  return { status: "success", message: GENERIC_MESSAGE }
}
