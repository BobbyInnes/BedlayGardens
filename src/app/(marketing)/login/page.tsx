import type { Metadata } from "next"
import Link from "next/link"
import { LoginForm } from "@/components/marketing/login-form"

export const metadata: Metadata = {
  title: "Log In",
  description: "Log in to your Bedlay Gardens Kennels account.",
}

export default function LoginPage() {
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
      <LoginForm />
    </div>
  )
}
