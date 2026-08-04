"use server"

import { redirect } from "next/navigation"
import { AuthError } from "next-auth"
import { auth, signIn } from "@/auth"
import { prisma } from "@/lib/prisma"

export type LoginState = {
  status: "idle" | "error" | "success"
  message?: string
}

export async function loginWithPassword(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  try {
    // redirect: false so we can send super admins to /admin instead of
    // /portal — next/navigation's redirect() below throws on purpose once
    // we know who signed in.
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { status: "error", message: "Invalid email or password." }
    }
    throw error
  }

  const session = await auth()
  redirect(session?.user.isSuperAdmin ? "/admin" : "/portal")
}

export async function loginWithMagicLink(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get("email")
  if (typeof email !== "string" || !email) {
    return { status: "error", message: "Enter your email address." }
  }

  // The magic link is confirmed later when the user clicks it in their
  // inbox, so we can't inspect the session yet — look the role up now to
  // decide where that click should land them.
  const user = await prisma.user.findUnique({
    where: { email },
    select: { isSuperAdmin: true },
  })

  try {
    await signIn("resend", { email, redirectTo: user?.isSuperAdmin ? "/admin" : "/portal" })
    return { status: "success" }
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        status: "error",
        message: "Couldn't send a sign-in link. Please try again.",
      }
    }
    throw error
  }
}
