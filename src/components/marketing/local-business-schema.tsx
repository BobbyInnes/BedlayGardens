import { getSettings } from "@/lib/settings"

export async function LocalBusinessSchema() {
  const settings = await getSettings()

  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: settings.business_name ?? "Bedlay Gardens Kennels",
    description: settings.business_tagline,
    telephone: settings.business_phone,
    email: settings.business_email,
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.business_address_line1,
      addressLocality: settings.business_address_line2,
      postalCode: settings.business_postcode,
      addressCountry: "GB",
    },
    geo:
      settings.business_lat && settings.business_lng
        ? {
            "@type": "GeoCoordinates",
            latitude: settings.business_lat,
            longitude: settings.business_lng,
          }
        : undefined,
    openingHours: settings.opening_hours,
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
