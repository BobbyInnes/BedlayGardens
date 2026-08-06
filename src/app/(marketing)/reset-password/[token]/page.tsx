import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { ResetPasswordForm } from "@/components/marketing/reset-password-form"

export const metadata: Metadata = {
  title: "Choose a New Password",
}

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Read-only check so an expired/used/unknown link shows a clear message
  // instead of a form that will just fail on submit — the action itself
  // re-checks this at submit time regardless, since state can change
  // between page load and submit.
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } })
  const isValid = !!resetToken && !resetToken.usedAt && resetToken.expiresAt > new Date()

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Choose a new password</h1>
      </div>
      {isValid ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            This reset link is invalid or has expired.
          </p>
          <Link href="/forgot-password" className="font-medium text-primary hover:underline">
            Request a new link
          </Link>
        </div>
      )}
    </div>
  )
}
