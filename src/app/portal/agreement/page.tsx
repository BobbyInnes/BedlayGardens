import type { Metadata } from "next"
import { auth } from "@/auth"
import { getActiveAgreement, hasCurrentSignedAgreement } from "@/lib/agreement"
import { sanitizeRichText } from "@/lib/sanitize-html"
import { SignAgreementForm } from "@/components/portal/sign-agreement-form"

export const metadata: Metadata = {
  title: "Boarding Agreement",
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

  if (!agreement) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p className="text-sm text-muted-foreground">No agreement is currently published.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Boarding Agreement</h1>

      <div
        className="max-h-96 overflow-y-auto rounded-lg border border-border p-4 text-sm"
        dangerouslySetInnerHTML={{ __html: sanitizeRichText(agreement.text) }}
      />

      {alreadySigned ? (
        <p className="text-sm text-primary">You&rsquo;ve already signed the current version — thank you.</p>
      ) : (
        <SignAgreementForm agreementId={agreement.id} returnTo={returnTo} />
      )}
    </div>
  )
}
