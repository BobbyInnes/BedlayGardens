// Central list of the slugs behind two service splits the rest of the code
// still treats as one family:
//
// - Day Care used to be one "daycare" service with a Full/Half Day choice
//   inside the booking wizard. It's now two separate bookable services —
//   "Day Care (Full Day)" (dayfull) and "Day Care (Half Day)" (dayhalf) —
//   sharing one daily capacity pool (the "daycare_max_capacity" Setting),
//   with duration determined by which one was booked rather than a runtime
//   toggle.
// - "Dog Walking (Van Collection)" (slug "dog-walking") was renamed/reslugged
//   to "Dog Walking (Group)" (walkgroup) to sit alongside the already-split
//   "Dog Walking (Solo)" (walksolo, split out 2026-09-10) — same booking
//   behavior as the old "dog-walking" service, just a new slug.
//
// Every place that used to hardcode the old "daycare"/"dog-walking" slugs
// should check against these instead, so a future rename/split doesn't have
// to be hunted down file by file again.
export const DAYCARE_SLUGS = ["dayfull", "dayhalf"] as const
export type DaycareSlug = (typeof DAYCARE_SLUGS)[number]

export function isDaycareSlug(slug: string): slug is DaycareSlug {
  return (DAYCARE_SLUGS as readonly string[]).includes(slug)
}

export const DOG_WALKING_SLUGS = ["walkgroup", "walksolo"] as const
export type DogWalkingSlug = (typeof DOG_WALKING_SLUGS)[number]

export function isDogWalkingSlug(slug: string): slug is DogWalkingSlug {
  return (DOG_WALKING_SLUGS as readonly string[]).includes(slug)
}

// Same-site, weekday-scheduled services shown in the admin "today" dashboard
// and staff on-site lists — see admin/page.tsx's SCHEDULED_SERVICE_SLUGS and
// the several ON_SITE_SERVICE_SLUGS copies (care-tasks.ts, staff pages).
export const ON_SITE_SERVICE_SLUGS = ["overnight-boarding", ...DAYCARE_SLUGS] as const
