import { prisma } from "@/lib/prisma"
import { getSettings } from "@/lib/settings"

export async function LocalBusinessSchema() {
  const [settings, approvedReviews] = await Promise.all([
    getSettings(),
    prisma.review.findMany({ where: { status: "APPROVED" }, select: { rating: true } }),
  ])

  const reviewCount = approvedReviews.length
  const averageRating =
    reviewCount > 0 ? approvedReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount : null

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
    aggregateRating:
      averageRating != null
        ? {
            "@type": "AggregateRating",
            ratingValue: averageRating.toFixed(1),
            reviewCount,
          }
        : undefined,
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
