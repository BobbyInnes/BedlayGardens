export type LocalArea = { slug: string; name: string }

// Towns/areas around Chryston, Glasgow (the business's real location) that
// customers plausibly search "near me" from — used to generate local
// landing pages per §13.3. Not admin-configurable; edit here if the service
// area changes.
export const LOCAL_AREAS: LocalArea[] = [
  { slug: "glasgow", name: "Glasgow" },
  { slug: "chryston", name: "Chryston" },
  { slug: "muirhead", name: "Muirhead" },
  { slug: "stepps", name: "Stepps" },
  { slug: "moodiesburn", name: "Moodiesburn" },
  { slug: "gartcosh", name: "Gartcosh" },
  { slug: "bishopbriggs", name: "Bishopbriggs" },
]

// Only services that make sense as a "near me" local search — not meet-greet,
// which nobody searches for by location.
export const LOCAL_SEO_SERVICE_SLUGS = ["overnight-boarding", "daycare", "secure-forest-walks", "dog-walking"]

export function findLocalArea(slug: string): LocalArea | undefined {
  return LOCAL_AREAS.find((a) => a.slug === slug)
}
