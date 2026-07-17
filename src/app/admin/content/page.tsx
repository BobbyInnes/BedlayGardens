import type { Metadata } from "next"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getSetting } from "@/lib/settings"
import { BusinessEmailForm } from "@/components/admin/business-email-form"
import { OpeningHoursForm } from "@/components/admin/opening-hours-form"
import { FaqCreateForm } from "@/components/admin/faq-create-form"
import { FaqListItem } from "@/components/admin/faq-list-item"
import { TestimonialCreateForm } from "@/components/admin/testimonial-create-form"
import { TestimonialListItem } from "@/components/admin/testimonial-list-item"
import { PublishAgreementForm } from "@/components/admin/publish-agreement-form"
import { GoogleReviewUrlForm } from "@/components/admin/google-review-url-form"

export const metadata: Metadata = {
  title: "Content | Admin",
}

export default async function AdminContentPage() {
  const [session, openingHours, faqs, testimonials, activeAgreement, googleReviewUrl, businessEmail] =
    await Promise.all([
      auth(),
      getSetting("opening_hours", ""),
      prisma.faq.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.testimonial.findMany({ orderBy: { id: "asc" } }),
      prisma.agreement.findFirst({ where: { active: true }, orderBy: { publishedAt: "desc" } }),
      getSetting("google_business_review_url", ""),
      getSetting("business_email", ""),
    ])
  const isSuperAdmin = session?.user.isSuperAdmin ?? false

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Content</h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Business email</h2>
        <p className="text-sm text-muted-foreground">
          Shown on the contact page and site footer, and used as the recipient for contact-form
          messages and admin notifications.
        </p>
        {isSuperAdmin ? (
          <BusinessEmailForm email={businessEmail} />
        ) : (
          <p className="text-sm">
            <span className="font-medium">{businessEmail || "Not set"}</span>
            <span className="text-muted-foreground"> — only a super admin can change this.</span>
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Opening hours</h2>
        <OpeningHoursForm openingHours={openingHours} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">FAQs</h2>
        <FaqCreateForm />
        {faqs.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {faqs.map((faq) => (
              <FaqListItem key={faq.id} faq={faq} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No FAQs yet.</p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Testimonials</h2>
        <TestimonialCreateForm />
        {testimonials.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {testimonials.map((testimonial) => (
              <TestimonialListItem key={testimonial.id} testimonial={testimonial} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No testimonials yet.</p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Boarding agreement</h2>
        <PublishAgreementForm currentVersion={activeAgreement?.version} currentText={activeAgreement?.text} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Google Business</h2>
        <p className="text-sm text-muted-foreground">
          Included as a link in post-stay review request emails.
        </p>
        <GoogleReviewUrlForm url={googleReviewUrl} />
      </section>
    </div>
  )
}
