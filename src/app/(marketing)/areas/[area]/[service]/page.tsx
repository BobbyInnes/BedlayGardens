import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import { formatPriceWithSuffix } from "@/lib/format"
import { getSettings } from "@/lib/settings"
import { LOCAL_AREAS, LOCAL_SEO_SERVICE_SLUGS, findLocalArea } from "@/lib/local-seo"

export const revalidate = 3600

export async function generateStaticParams() {
  const services = await prisma.service.findMany({
    where: { active: true, slug: { in: LOCAL_SEO_SERVICE_SLUGS } },
  })
  return LOCAL_AREAS.flatMap((area) =>
    services.map((service) => ({ area: area.slug, service: service.slug }))
  )
}

async function loadPageData(areaSlug: string, serviceSlug: string) {
  const area = findLocalArea(areaSlug)
  if (!area || !LOCAL_SEO_SERVICE_SLUGS.includes(serviceSlug)) return null
  const service = await prisma.service.findUnique({ where: { slug: serviceSlug } })
  if (!service || !service.active) return null
  return { area, service }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ area: string; service: string }>
}): Promise<Metadata> {
  const { area: areaSlug, service: serviceSlug } = await params
  const data = await loadPageData(areaSlug, serviceSlug)
  if (!data) return {}
  const { area, service } = data
  const title = `${service.name} near ${area.name}`
  const description = `${service.name} for dogs near ${area.name}, based at our secure countryside site in Chryston. Real-time availability and simple online booking.`
  return { title, description }
}

export default async function LocalAreaServicePage({
  params,
}: {
  params: Promise<{ area: string; service: string }>
}) {
  const { area: areaSlug, service: serviceSlug } = await params
  const data = await loadPageData(areaSlug, serviceSlug)
  if (!data) notFound()
  const { area, service } = data

  const settings = await getSettings()
  const businessName = settings.business_name ?? "Bedlay Gardens Kennels"
  const otherAreas = LOCAL_AREAS.filter((a) => a.slug !== area.slug)

  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: service.name,
    provider: { "@type": "LocalBusiness", name: businessName },
    areaServed: { "@type": "Place", name: area.name },
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        {service.name} near {area.name}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Looking for {service.name.toLowerCase()} near {area.name}? {businessName} is a family-run,
        secure countryside site in Chryston, a short drive from {area.name} — with real-time
        availability and simple online booking.
      </p>

      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{service.name}</h2>
          <p className="text-xl font-semibold text-primary">
            {formatPriceWithSuffix(service.basePricePence, service.pricingModel)}
          </p>
        </div>
        <p className="mt-3 text-muted-foreground">{service.description}</p>
        <Button className="mt-6" asChild>
          <Link href={`/book/${service.slug}`}>Book {service.name}</Link>
        </Button>
      </div>

      <div className="mt-12">
        <h2 className="text-lg font-semibold">Also serving nearby areas</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {otherAreas.map((other) => (
            <Link
              key={other.slug}
              href={`/areas/${other.slug}/${service.slug}`}
              className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              {service.name} near {other.name}
            </Link>
          ))}
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </div>
  )
}
