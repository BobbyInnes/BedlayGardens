import Link from "next/link"
import { Clock, Mail, MapPin, Phone } from "lucide-react"

import { Logo } from "@/components/marketing/logo"
import { getSettings } from "@/lib/settings"
import { APP_VERSION } from "@/lib/version"

const quickLinks = [
  { href: "/services", label: "Services" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/gallery", label: "Gallery" },
  { href: "/about", label: "About Us" },
  { href: "/faqs", label: "FAQs" },
  { href: "/book", label: "Book Now" },
]

export async function SiteFooter() {
  const settings = await getSettings()
  const businessName = settings.business_name ?? "Bedlay Gardens Kennels"
  const phone = settings.business_phone ?? ""
  const email = settings.business_email ?? ""
  const addressLine1 = settings.business_address_line1 ?? ""
  const addressLine2 = settings.business_address_line2 ?? ""
  const postcode = settings.business_postcode ?? ""
  const openingHours = settings.opening_hours ?? ""

  return (
    <footer className="bg-navy pb-24 text-navy-foreground md:pb-0">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          {/* Logo artwork has a solid white background baked in — pad it in
              a rounded white card so it reads cleanly on the dark footer. */}
          <div className="inline-block rounded-lg bg-white px-3 py-2">
            <Logo businessName={businessName} />
          </div>
          <p className="text-sm leading-relaxed text-white/70">
            Safe, caring, and fully managed stays for your dog — licensed,
            council approved, and trusted by owners across Glasgow for over a
            decade.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-white/90">
            Quick links
          </h2>
          <ul className="space-y-2 text-sm text-white/70">
            {quickLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-colors hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 text-sm text-white/70">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-white/90">
            Contact
          </h2>
          {addressLine1 && (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                {addressLine1}
                {addressLine2 ? `, ${addressLine2}` : ""}
                {postcode ? ` ${postcode}` : ""}
              </span>
            </div>
          )}
          {phone && (
            <div className="flex items-center gap-2">
              <Phone className="size-4 shrink-0" aria-hidden="true" />
              <a
                href={`tel:${phone.replace(/\s+/g, "")}`}
                className="transition-colors hover:text-white"
              >
                {phone}
              </a>
            </div>
          )}
          {email && (
            <div className="flex items-center gap-2">
              <Mail className="size-4 shrink-0" aria-hidden="true" />
              <a href={`mailto:${email}`} className="break-all transition-colors hover:text-white">
                {email}
              </a>
            </div>
          )}
          <div className="flex items-center gap-2">
            <svg
              className="size-4 shrink-0"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            <a
              href="https://www.facebook.com/BedlayGardensDogBoarding"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              Facebook
            </a>
          </div>
        </div>

        <div className="space-y-3 text-sm text-white/70">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-white/90">
            Opening hours
          </h2>
          {openingHours && (
            <ul className="space-y-2">
              {openingHours.split("·").map((line) => (
                <li key={line.trim()} className="flex items-start gap-2">
                  <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{line.trim()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t border-white/10 px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 text-xs text-white/60 sm:flex-row">
          <p>
            © {new Date().getFullYear()} Mr. Robert A Innes. All rights reserved.{" "}
            <span className="font-semibold text-white">(Site version {APP_VERSION})</span>
          </p>
          <div className="flex items-center gap-4">
            <Link href="/legal/privacy" className="transition-colors hover:text-white">
              Privacy Policy
            </Link>
            <Link href="/legal/terms" className="transition-colors hover:text-white">
              Terms & Conditions
            </Link>
            <Link href="/legal/cookies" className="transition-colors hover:text-white">
              Cookie Notice
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
