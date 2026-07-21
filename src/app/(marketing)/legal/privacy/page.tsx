import type { Metadata } from "next"
import { LegalPage } from "@/components/marketing/legal-page"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Bedlay Gardens LTD collects, uses, and protects your personal data.",
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="10 July 2026">
      <p>
        This placeholder policy outlines how Bedlay Gardens LTD (&ldquo;we&rdquo;, &ldquo;us&rdquo;)
        handles personal data in line with UK GDPR. Replace this text with your
        finalised policy before launch.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Contact details: name, email, phone, address</li>
        <li>Dog profile details: name, breed, medical and behavioural notes</li>
        <li>Vaccination certificates and related documents</li>
        <li>Booking and payment history (processed via Stripe)</li>
        <li>Messages sent through our contact form</li>
      </ul>

      <h2>How we use it</h2>
      <p>
        We use your information to process bookings, manage your dog&rsquo;s stay,
        communicate about appointments and payments, and meet our legal and
        insurance obligations. We do not sell your data.
      </p>

      <h2>Vaccination and vet documents</h2>
      <p>
        Uploaded certificates and vet documents are access-controlled and never
        made available via public URLs. Only you and authorised staff can view
        them.
      </p>

      <h2>Your rights</h2>
      <p>
        You can request a copy of the data we hold about you, ask us to correct
        it, or request account deletion from your account settings or by
        contacting us directly. Some records (e.g. payment history) may be
        retained where required by law.
      </p>

      <h2>Contact</h2>
      <p>
        For any privacy questions, use the details on our{" "}
        <a href="/contact" className="text-primary hover:underline">
          Contact Us
        </a>{" "}
        page.
      </p>
    </LegalPage>
  )
}
