import Link from "next/link"
import { PawPrint, Mail, Phone, MapPin } from "lucide-react"
import { getSettings } from "@/lib/settings"

const legalLinks = [
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/terms", label: "Terms & Conditions" },
  { href: "/legal/cookies", label: "Cookie Notice" },
]

const exploreLinks = [
  { href: "/services", label: "Services" },
  { href: "/gallery", label: "Gallery" },
  { href: "/about", label: "About Us" },
  { href: "/faqs", label: "FAQs" },
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
    <footer className="mt-16 border-t border-border bg-secondary/40 pb-24 md:pb-0">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 sm:grid-cols-2 md:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-semibold">
            <PawPrint className="size-5 text-primary" aria-hidden="true" />
            {businessName}
          </div>
          <p className="text-sm text-muted-foreground">
            {settings.business_tagline}
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Explore</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {exploreLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-foreground">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Legal</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {legalLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-foreground">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 text-sm text-muted-foreground">
          <h3 className="text-sm font-semibold text-foreground">Get in touch</h3>
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
              <a href={`tel:${phone.replace(/\s+/g, "")}`} className="hover:text-foreground">
                {phone}
              </a>
            </div>
          )}
          {email && (
            <div className="flex items-center gap-2">
              <Mail className="size-4 shrink-0" aria-hidden="true" />
              <a href={`mailto:${email}`} className="hover:text-foreground">
                {email}
              </a>
            </div>
          )}
          {openingHours && <p>{openingHours}</p>}
        </div>
      </div>

      <div className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
        © {new Date().getFullYear()} {businessName}. All rights reserved.
      </div>
    </footer>
  )
}
