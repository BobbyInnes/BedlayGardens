import type { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"
import { LOCAL_AREAS, LOCAL_SEO_SERVICE_SLUGS } from "@/lib/local-seo"

export const revalidate = 60

const staticRoutes = [
  "",
  "/services",
  "/gallery",
  "/about",
  "/contact",
  "/faqs",
  "/legal/privacy",
  "/legal/terms",
  "/legal/cookies",
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"

  const services = await prisma.service.findMany({ where: { active: true } })

  const serviceEntries: MetadataRoute.Sitemap = services.map((service) => ({
    url: `${baseUrl}/services#${service.slug}`,
    lastModified: new Date(),
  }))

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
  }))

  const localSeoServices = services.filter((s) => LOCAL_SEO_SERVICE_SLUGS.includes(s.slug))
  const localAreaEntries: MetadataRoute.Sitemap = LOCAL_AREAS.flatMap((area) =>
    localSeoServices.map((service) => ({
      url: `${baseUrl}/areas/${area.slug}/${service.slug}`,
      lastModified: new Date(),
    }))
  )

  return [...staticEntries, ...serviceEntries, ...localAreaEntries]
}
