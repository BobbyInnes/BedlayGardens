import type { DogFlagType } from "@/generated/prisma/client"

export const DOG_FLAG_LABELS: Record<DogFlagType, string> = {
  NOT_DOG_SOCIABLE: "Not dog-sociable",
  NO_SHARED_KENNEL: "No shared accommodation",
  NO_GROUP_WALKS: "No group walks",
  RESOURCE_GUARDING: "Resource guarding",
  ESCAPE_RISK: "Escape risk",
}

export const DOG_FLAG_TYPES: DogFlagType[] = [
  "NOT_DOG_SOCIABLE",
  "NO_SHARED_KENNEL",
  "NO_GROUP_WALKS",
  "RESOURCE_GUARDING",
  "ESCAPE_RISK",
]

/** Flags that block a self-service group booking (forest walks / dog-walking van runs) unless overridden. */
export const GROUP_BLOCKING_FLAGS: DogFlagType[] = ["NOT_DOG_SOCIABLE", "NO_GROUP_WALKS"]

/** Flag that blocks more than one dog sharing a single kennel unit unless overridden. */
export const SHARED_KENNEL_BLOCKING_FLAG: DogFlagType = "NO_SHARED_KENNEL"
