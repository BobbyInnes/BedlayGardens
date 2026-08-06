import type { Metadata } from "next"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getSetting, getSettings } from "@/lib/settings"
import { AnnouncementBannerForm } from "@/components/admin/announcement-banner-form"
import { AboutBannerForm } from "@/components/admin/about-banner-form"
import { AboutTextForm } from "@/components/admin/about-text-form"
import { NavVisibilityForm } from "@/components/admin/nav-visibility-form"
import {
  updateAboutStory,
  updateAboutFacility,
  updateTermsConditions,
  updateVacancies,
} from "@/app/admin/content/actions"
import { BusinessEmailForm } from "@/components/admin/business-email-form"
import { VaccinationReviewEmailForm } from "@/components/admin/vaccination-review-email-form"
import { OpeningHoursForm } from "@/components/admin/opening-hours-form"
import { FaqCreateForm } from "@/components/admin/faq-create-form"
import { FaqListItem } from "@/components/admin/faq-list-item"
import { TestimonialCreateForm } from "@/components/admin/testimonial-create-form"
import { TestimonialListItem } from "@/components/admin/testimonial-list-item"
import { GoogleReviewUrlForm } from "@/components/admin/google-review-url-form"
import { VatSettingsForm } from "@/components/admin/vat-settings-form"

export const metadata: Metadata = {
  title: "Content | Admin",
}

export default async function AdminContentPage() {
  const [
    session,
    openingHours,
    faqs,
    testimonials,
    googleReviewUrl,
    businessEmail,
    vaccinationReviewEmail,
    announcementBanner,
    aboutBanner,
    aboutStory,
    aboutFacility,
    termsConditions,
    vacancies,
    settings,
  ] = await Promise.all([
      auth(),
      getSetting("opening_hours", ""),
      prisma.faq.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.testimonial.findMany({ orderBy: { id: "asc" } }),
      getSetting("google_business_review_url", ""),
      getSetting("business_email", ""),
      getSetting("vaccination_review_email", ""),
      getSetting("announcement_banner", ""),
      getSetting("about_banner", ""),
      getSetting("about_story", ""),
      getSetting("about_facility", ""),
      getSetting("terms_conditions", ""),
      getSetting("vacancies", ""),
      getSettings(),
    ])
  const isSuperAdmin = session?.user.isSuperAdmin ?? false

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Content</h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Main menu</h2>
        <p className="text-sm text-muted-foreground">
          Choose which links appear in the site&rsquo;s main menu. Unticking an item hides it from
          both the desktop and mobile menu — the page itself still exists, it just won&rsquo;t be
          linked from the menu.
        </p>
        <NavVisibilityForm settings={settings} />
      </section>

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
        <h2 className="text-lg font-semibold">Vaccination review notifications</h2>
        <p className="text-sm text-muted-foreground">
          Once a day, if any vaccination certificates are still awaiting review, a summary is
          emailed to this address. Leave blank to turn the notification off.
        </p>
        <VaccinationReviewEmailForm
          email={vaccinationReviewEmail}
          immediate={settings.vaccination_review_immediate === "true"}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Announcement banner</h2>
        <AnnouncementBannerForm banner={announcementBanner} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">About page banner</h2>
        <AboutBannerForm banner={aboutBanner} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">About page — Our story</h2>
        <AboutTextForm
          action={updateAboutStory}
          name="about_story"
          value={aboutStory}
          placeholder="The 'Our story' text shown on the About Us page…"
          helpText="Shown in the 'Our story' section of the About Us page. Leave blank to use the default text."
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">About page — Our facility</h2>
        <AboutTextForm
          action={updateAboutFacility}
          name="about_facility"
          value={aboutFacility}
          placeholder="The 'Our facility' text shown on the About Us page…"
          helpText="Shown in the 'Our facility' section of the About Us page. Leave blank to use the default text."
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Terms &amp; Conditions</h2>
        <AboutTextForm
          action={updateTermsConditions}
          name="terms_conditions"
          value={termsConditions}
          placeholder="The terms shown on the public Terms & Conditions page…"
          helpText="Shown on the public /legal/terms page, linked from the site footer and the booking review step. Leave blank to use the default placeholder text."
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Vacancies</h2>
        <AboutTextForm
          action={updateVacancies}
          name="vacancies"
          value={vacancies}
          placeholder="Details of current job vacancies…"
          helpText="Shown on the public /vacancies page, linked from the site menu. Leave blank to show 'No current vacancies'."
        />
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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">VAT details</h2>
        <p className="text-sm text-muted-foreground">
          Used by the Accounting page to split each transaction into net/VAT/gross and to work out
          VAT period boundaries. The VAT-enabled toggle itself is on Pricing &amp; Capacity.
        </p>
        <VatSettingsForm
          vatNumber={settings.vat_number ?? ""}
          ratePercent={settings.vat_rate_percent ?? "20"}
          periodStartMonth={settings.vat_period_start_month ?? "1"}
          periodLength={settings.vat_period_length ?? "QUARTERLY"}
        />
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
