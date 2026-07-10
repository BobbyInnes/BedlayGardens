import type { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"

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

  return [...staticEntries, ...serviceEntries]
}
