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
