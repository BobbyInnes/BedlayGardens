import type { Metadata } from "next"
import { LegalPage } from "@/components/marketing/legal-page"
import { getSetting } from "@/lib/settings"
import { sanitizeRichText } from "@/lib/sanitize-html"

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Booking, payment, and cancellation terms for Bedlay Gardens LTD.",
}

export const revalidate = 60

export default async function TermsPage() {
  const termsConditions = await getSetting("terms_conditions", "")

  if (termsConditions.trim()) {
    return (
      <LegalPage title="Terms & Conditions" updated="10 July 2026">
        <div dangerouslySetInnerHTML={{ __html: sanitizeRichText(termsConditions) }} />
      </LegalPage>
    )
  }

  return (
    <LegalPage title="Terms & Conditions" updated="10 July 2026">
      <p>
        This placeholder sets out the terms that apply when you book with Bedlay
        Gardens LTD. Replace this text with your finalised terms before
        launch, ideally reviewed alongside the digital boarding agreement.
      </p>

      <h2>Vaccinations</h2>
      <p>
        A dog can only be boarded, walked in a group, or attend daycare once
        valid, in-date vaccination records covering the full length of the stay
        are on file and verified.
      </p>

      <h2>Deposits and payment</h2>
      <p>
        A deposit is required to confirm a booking, with the balance charged
        automatically ahead of check-in unless paid manually beforehand.
        Cancellation refunds follow the policy below.
      </p>

      <h2>Cancellation policy</h2>
      <ul>
        <li>14 or more days before check-in: full refund</li>
        <li>Within 14 days: deposit forfeited</li>
        <li>Within 48 hours: no refund</li>
      </ul>

      <h2>Dog behaviour and safety</h2>
      <p>
        We ask owners to disclose any behavioural flags (e.g. resource guarding,
        escape risk, not sociable with other dogs) accurately at booking. We
        reserve the right to decline or end a stay where a dog&rsquo;s behaviour
        presents a risk to staff, other guests, or itself.
      </p>

      <h2>Liability</h2>
      <p>
        While every care is taken, boarding, daycare, and walking involve
        inherent risks to animals. Full liability terms are set out in our
        boarding agreement, which owners sign before their dog&rsquo;s first stay.
      </p>
    </LegalPage>
  )
}
