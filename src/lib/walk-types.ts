import type { WalkType } from "@/generated/prisma/client"

// Dog Walking walk types — see WalkType in schema.prisma for the operational
// rationale. Daily-capacity figures are business decisions Bobby set
// directly (2026-09-10), not admin-configurable yet; if that's ever needed,
// move these into Setting rows like daycare_max_capacity. Price is NOT
// hardcoded here — it's read from each walk type's Service row
// (basePricePence) via WALK_TYPE_SERVICE_SLUG below, so admins can change it
// from the Services page without a code change.
export const WALK_TYPES: WalkType[] = ["GROUP_WALK", "SOLO_WALK", "PUPPY_WALK_AND_PLAY"]

export const DEFAULT_WALK_TYPE: WalkType = "GROUP_WALK"

export const WALK_TYPE_LABELS: Record<WalkType, string> = {
  GROUP_WALK: "1 Hour Group Walk",
  SOLO_WALK: "1 Hour Solo Walk",
  PUPPY_WALK_AND_PLAY: "1 Hour Puppy Walk and Play Time",
}

// Which Service each walk type is booked and priced under. Solo was split
// out into its own "Dog Walking (Solo)" service (slug "walksolo") on
// 2026-09-10 so it can be priced and capacity-tracked independently of
// Group; Puppy still rides along under "Dog Walking (Van Collection)" since
// there's no dedicated customer-facing service for it yet.
export const WALK_TYPE_SERVICE_SLUG: Record<WalkType, string> = {
  GROUP_WALK: "dog-walking",
  SOLO_WALK: "walksolo",
  PUPPY_WALK_AND_PLAY: "dog-walking",
}

// Max dogs per day, per type — Solo/Puppy are 1-on-1 staff time, so only one
// per day; Group matches the old van run's typical maxDogs.
export const WALK_TYPE_MAX_PER_DAY: Record<WalkType, number> = {
  GROUP_WALK: 17,
  SOLO_WALK: 1,
  PUPPY_WALK_AND_PLAY: 1,
}
