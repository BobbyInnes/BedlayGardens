import type { WalkType } from "@/generated/prisma/client"

// Dog Walking (Van Collection) walk types — see WalkType in schema.prisma
// for the operational rationale. Price and daily-capacity figures are
// business decisions Bobby set directly (2026-09-10), not admin-configurable
// yet; if that's ever needed, move these into Setting rows like
// daycare_max_capacity.
export const WALK_TYPES: WalkType[] = ["GROUP_WALK", "SOLO_WALK", "PUPPY_WALK_AND_PLAY"]

export const DEFAULT_WALK_TYPE: WalkType = "GROUP_WALK"

export const WALK_TYPE_LABELS: Record<WalkType, string> = {
  GROUP_WALK: "1 Hour Group Walk",
  SOLO_WALK: "1 Hour Solo Walk",
  PUPPY_WALK_AND_PLAY: "1 Hour Puppy Walk and Play Time",
}

export const WALK_TYPE_PRICE_PENCE: Record<WalkType, number> = {
  GROUP_WALK: 1200,
  SOLO_WALK: 1800,
  PUPPY_WALK_AND_PLAY: 1800,
}

// Max dogs per day, per type — Solo/Puppy are 1-on-1 staff time, so only one
// per day; Group matches the old van run's typical maxDogs.
export const WALK_TYPE_MAX_PER_DAY: Record<WalkType, number> = {
  GROUP_WALK: 17,
  SOLO_WALK: 1,
  PUPPY_WALK_AND_PLAY: 1,
}
