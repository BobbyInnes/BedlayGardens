"use server"

import { AuthError } from "next-auth"
import { signIn } from "@/auth"

export type LoginState = {
  status: "idle" | "error" | "success"
  message?: string
}

export async function loginWithPassword(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/portal",
    })
    return { status: "success" }
  } catch (error) {
    if (error instanceof AuthError) {
      return { status: "error", message: "Invalid email or password." }
    }
    throw error
  }
}

export async function loginWithMagicLink(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get("email")
  if (typeof email !== "string" || !email) {
    return { status: "error", message: "Enter your email address." }
  }

  try {
    await signIn("resend", { email, redirectTo: "/portal" })
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
