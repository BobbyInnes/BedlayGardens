import type { Metadata } from "next"
import { LegalPage } from "@/components/marketing/legal-page"

export const metadata: Metadata = {
  title: "Cookie Notice",
  description: "How Bedlay Gardens Kennels uses cookies on this website.",
}

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Notice" updated="10 July 2026">
      <p>
        This placeholder notice explains how we use cookies. Replace with your
        finalised notice, and connect it to a cookie consent banner before
        launch, as required for UK GDPR.
      </p>

      <h2>Essential cookies</h2>
      <p>
        Used to keep you signed in and to remember items like your booking in
        progress. These cannot be switched off, as the site cannot function
        without them.
      </p>

      <h2>Analytics cookies</h2>
      <p>
        If enabled, these help us understand how visitors use the site so we
        can improve it. They are optional and only set with your consent.
      </p>

      <h2>Managing cookies</h2>
      <p>
        You can control or delete cookies through your browser settings at any
        time. Doing so may affect some site functionality, such as staying
        signed in.
      </p>
    </LegalPage>
  )
}
