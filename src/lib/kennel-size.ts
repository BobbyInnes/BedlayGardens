import { DOG_SIZE_ORDER } from "@/lib/dog-size-colors"

/**
 * KennelUnit.size is free text an admin typed into a plain input over time
 * (see kennel-unit-form.tsx) — never a controlled vocabulary matching the
 * DogSize enum. Real production values include "Extra Small", "Extra
 * Large", "medium" (lowercase), "Small Plus (Extra Height)", a typo
 * "...Height)1", and "Kennel" (used as an accommodation *type* label —
 * "Kennel 01", "DC Middle (couch)" — not a size at all).
 *
 * Returns the unit's rank on DOG_SIZE_ORDER, or null when the text carries
 * no size information (a "Kennel"-type label). Callers must treat null as
 * "fits any size" rather than excluding the unit — confirmed with the
 * business, since the label alone doesn't say what these are sized for, and
 * excluding them would wrongly reject every one of these units for every
 * dog. Revisit once kennel names/sizes are cleaned up in admin.
 */
export function kennelSizeRank(rawSize: string): number | null {
  const s = rawSize.trim().toLowerCase()
  if (s.includes("extra small")) return DOG_SIZE_ORDER.indexOf("MINIATURE")
  if (s.includes("extra large")) return DOG_SIZE_ORDER.indexOf("GIANT")
  if (s.includes("small")) return DOG_SIZE_ORDER.indexOf("SMALL")
  if (s.includes("medium")) return DOG_SIZE_ORDER.indexOf("MEDIUM")
  if (s.includes("large")) return DOG_SIZE_ORDER.indexOf("LARGE")
  return null
}
