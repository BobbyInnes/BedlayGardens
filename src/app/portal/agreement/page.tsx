import type { Metadata } from "next"
import { FileText } from "lucide-react"
import { auth } from "@/auth"
import { getActiveAgreement, hasCurrentSignedAgreement } from "@/lib/agreement"
import { SignAgreementForm } from "@/components/portal/sign-agreement-form"

export const metadata: Metadata = {
  title: "Our Terms and Conditions",
}

export default async function AgreementPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { returnTo } = await searchParams
  const session = await auth()
  const agreement = await getActiveAgreement()
  const alreadySigned = session?.user ? await hasCurrentSignedAgreement(session.user.id) : false

  if (!agreement || !agreement.documentUrl) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p className="text-sm text-muted-foreground">No agreement is currently published.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Our Terms and Conditions</h1>

      <p className="font-bold text-destructive">
        Before booking any of our services at Bedlay Gardens, please review our Terms and Conditions by
        clicking on the below document link. This is to ensure that you have a clear understanding of our
        policies regarding Cancellations, Rescheduling &amp; Refunds, Booking Terms &amp; Opening Hours etc.
      </p>

      <a
        href={agreement.documentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-lg border border-border p-4 text-sm font-medium text-primary hover:bg-muted"
      >
        <FileText className="size-4 shrink-0" aria-hidden="true" />
        View Our Terms and Conditions (PDF) — opens in a new tab
      </a>

      {alreadySigned ? (
        <p className="text-sm text-primary">You&rsquo;ve already signed the current version — thank you.</p>
      ) : (
        <SignAgreementForm agreementId={agreement.id} returnTo={returnTo} />
      )}
    </div>
  )
}
