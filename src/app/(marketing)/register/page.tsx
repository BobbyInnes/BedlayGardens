import type { Metadata } from "next"
import Link from "next/link"
import { RegisterForm } from "@/components/marketing/register-form"

export const metadata: Metadata = {
  title: "Create an Account",
  description: "Create a Bedlay Gardens LTD account to book stays and manage your dog's profile.",
}

export default function RegisterPage() {
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
      <RegisterForm />
    </div>
  )
}
