import type { Metadata } from "next"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { auth } from "@/auth"
import { RegisterForm } from "@/components/marketing/register-form"
import { LogoutButton } from "@/components/portal/logout-button"

export const metadata: Metadata = {
  title: "Create an Account",
  description: "Create a Bedlay Gardens LTD account to book stays and manage your dog's profile.",
}

export default async function RegisterPage() {
  const session = await auth()

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Create an account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
      {session?.user ? (
        <div className="flex items-start gap-3 rounded-xl border border-destructive bg-destructive/10 p-4 text-destructive sm:items-center">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 sm:mt-0" aria-hidden="true" />
          <div className="space-y-3 text-sm">
            <p className="font-bold sm:text-base">
              You&rsquo;re already logged in{session.user.email ? ` as ${session.user.email}` : ""}. You
              can&rsquo;t create a new account while signed in.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/portal" className="font-medium underline underline-offset-2">
                Go to your dashboard
              </Link>
              <span aria-hidden="true">·</span>
              <LogoutButton />
            </div>
          </div>
        </div>
      ) : (
        <RegisterForm />
      )}
    </div>
  )
}
