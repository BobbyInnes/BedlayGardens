import type { Metadata } from "next"
import { Mail, MapPin, Phone, Clock } from "lucide-react"
import { ContactForm } from "@/components/marketing/contact-form"
import { getSettings } from "@/lib/settings"

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with Bedlay Gardens Kennels — address, phone, opening hours, and a contact form.",
}

export const revalidate = 60

export default async function ContactPage() {
  const settings = await getSettings()
  const addressLine1 = settings.business_address_line1 ?? ""
  const addressLine2 = settings.business_address_line2 ?? ""
  const postcode = settings.business_postcode ?? ""
  const fullAddress = [addressLine1, addressLine2, postcode].filter(Boolean).join(", ")
  const mapQuery = encodeURIComponent(fullAddress || "Glasgow, UK")

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Contact Us</h1>
        <p className="mt-3 text-muted-foreground">
          Questions about a stay, or want to arrange a visit? Send us a message below.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ContactForm />
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div className="space-y-3 text-sm">
            {fullAddress && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <span>{fullAddress}</span>
              </div>
            )}
            {settings.business_phone && (
              <div className="flex items-center gap-3">
                <Phone className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <a
                  href={`tel:${settings.business_phone.replace(/\s+/g, "")}`}
                  className="hover:underline"
                >
                  {settings.business_phone}
                </a>
              </div>
            )}
            {settings.business_email && (
              <div className="flex items-center gap-3">
                <Mail className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <a href={`mailto:${settings.business_email}`} className="hover:underline">
                  {settings.business_email}
                </a>
              </div>
            )}
            {settings.opening_hours && (
              <div className="flex items-center gap-3">
                <Clock className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <span>{settings.opening_hours}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <svg
                className="size-5 shrink-0 text-primary"
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
                className="hover:underline"
              >
                Find us on Facebook
              </a>
            </div>
          </div>

          <div className="aspect-4/3 overflow-hidden rounded-xl border border-border">
            <iframe
              title="Map"
              src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
              className="size-full"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
