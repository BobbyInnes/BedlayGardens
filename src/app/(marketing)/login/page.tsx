import type { Metadata } from "next"
import Link from "next/link"
import { LoginForm } from "@/components/marketing/login-form"

export const metadata: Metadata = {
  title: "Log In",
  description: "Log in to your Bedlay Gardens LTD account.",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>
}) {
  const { reset } = await searchParams

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Log in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>
      {reset === "success" && (
        <p
          className="mb-6 rounded-md border border-border bg-muted/50 p-4 text-center text-sm text-foreground"
          role="status"
        >
          Your password has been reset. Log in with your new password below.
        </p>
      )}
      <LoginForm />
    </div>
  )
}
