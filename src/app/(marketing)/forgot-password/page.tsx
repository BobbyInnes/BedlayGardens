import type { Metadata } from "next"
import Link from "next/link"
import { ForgotPasswordForm } from "@/components/marketing/forgot-password-form"

export const metadata: Metadata = {
  title: "Reset Your Password",
  description: "Request a link to reset your Bedlay Gardens LTD account password.",
}

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Reset your password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your email and we&rsquo;ll send you a link to choose a new password.{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  )
}
